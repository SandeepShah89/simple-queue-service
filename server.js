/* 
    WTO Simple Queue Service - Built for WeWebinar
    
    User stories to fulfill:

    1. Identification - TAG
    - As users enter the site, they'll have tokens in their URLs. We want to preserve these in a cookie, as their UUID.

    2. Redirection service - TAG, SERVICE
    - After each main-stage event, users get kicked out into the lobby. We need to:
    -- Present some kind of holding message?                - TAG
    -- Look up their ID, and:                               - SERVICE
    -- Allocate Leaders based on pre-defined mapping.       - SERVICE
    -- Allocate users on a front-fill basis.                - SERVICE
    - Return URL of where they should go.                   - SERVICE
    - Tag should pick up this URL and bounce them along.    - TAG

    Notes:
    - Allocation should be done based on event. Each event has a different set of allocations.
    // - Leaders should be looked up for pairings and entry before being allocated anywhere. NOT RELEVANT ANYMORE IF WE'RE ALLOCATING BASED ON STRICT MAPPINGS.

    3. On the fly definition of leader tokens - SERVICE 
    - WW should be able to provide leader tokens on the fly, and handle pairings.

    4. Monitoring of which tokens are in which rooms - SERVICE 
    - Should be able to pull the lists and provide monitoring at all times.

*/

const express = require('express');
let cookieParser = require('cookie-parser');

let fs = require('fs');
let util = require('util');
let debugMode = false;

let req_file = require('fs').createWriteStream(__dirname + '/requests.txt', {flags : 'a'});
let log_file = require('fs').createWriteStream(__dirname + '/log.txt', {flags : 'a'});
let err_file = require('fs').createWriteStream(__dirname + '/errors.txt', {flags : 'a'});

(function(){
    let old = process.stdout.write;
    
    process.stdout.write = function(a){
        old.apply(this, arguments);
        if(debugMode) log_file.write(a.replace('\n', "\r\n") + "\r\n");
    };

    let old2 = process.stderr.write;
    process.stderr.write = function(a){
        old2.apply(this, arguments);
        if(debugMode) err_file.write(a.replace('\n', "\r\n") + "\r\n");
    };

})();

const app = express();

app.use(cookieParser());
app.use((req, res, next) => {
    res.append('Access-Control-Allow-Origin', ['*']);
    res.append('Access-Control-Allow-Methods', 'GET,POST');
    next();
});

app.use((req, res, next) => {
    req_file.write(`${(new Date()).toISOString()} -- ${req.method} -- ${req.url}\r\n`);
    next();
});

const port = 3000;

let config = {
    'e1': {
        numberOfRooms: 75,
        roomURLs: [
            // ...roomURLs
            "room-url-0",
            "room-url-1",
            "room-url-2",
            "room-url-3",
            "room-url-4"
        ]
    },

    'e2': {
        numberOfRooms: 40,
        delegatesPerRoom: 5,
        roomURLs: [
            // ...roomURLs
            "room-url-0",
            "room-url-1",
            "room-url-2",
            "room-url-3",
            "room-url-4"
        ],
        leaderAllocation: {
            // token: roomIndex
            "leader-1": 0,
            "leader-2": 0,
            "leader-3": 1,
            "leader-4": 1
        }
    }
};

let allocation = {
    /* 
    e1: {
        last: N,
        rooms: [
            ...rooms as [...tokens]
        ]
    },

    e2: {
        curRoom: 0,
        rooms: {
            leaders: [...tokens],
            delegates: [...tokens]
        }
    }
    */
};

for(let key in config){
    let nOfRooms = config[key].numberOfRooms;

    if(key == "e1"){
        allocation[key] = {
            last: -1,
            rooms: (new Array( nOfRooms )).fill([]),
            userAllocation: {}
        };
    } else if(key == "e2") {

        allocation[key] = {
            curRoom: 0,
            rooms: {
                leaders: (new Array( nOfRooms )).fill([]),
                delegates: (new Array( nOfRooms )).fill([])
            },
            userAllocation: {}
        };

    }
};

let Setting_Event = false;

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/debugmode-start', (req, res) => {
    debugMode = true;
    res.send('Debug logging enabled');
});

app.get('/debugmode-stop', (req, res) => {
    debugMode = false;
    res.send('Debug logging stopped');
});

app.get('/setEvent', (req, res) => {
    let qs = req.query.event;

    if(!qs){
        res.send("Please provide ?event=");
        return;
    }

    if(qs == "unset"){
        Setting_Event = false;
        res.send("Event unset. Falling back to time-driven checks.");

    } else if(["1", "2", "main"].includes(qs)) {
        Setting_Event = qs;

        res.send(`Event set to: ${qs}`);
    
    } else {
        res.send(`Events allowed: 1, 2, main, unset`);
    }

});

const getEvent = _ => {
    
    let ts = Date.now();
    ts = ts - (new Date()).getTimezoneOffset();

    let tenAM = 1613815200000,
        tenThirtyAM = 1613817000000,
        midday = 1613822400000,
        twelveThirtyPM = 1613824200000
    ;

    if(ts < tenAM){
        return "main";

    } else if(ts < tenThirtyAM){
        return "1";

    } else if(ts < midday){
        return "main";

    } else if(ts < twelveThirtyPM){
        return "2";
        
    } else {
        return "main";

    }

};

app.get('/enter', (req, res) => {

    console.log('\n\n/enter');

    let uuid = req.query.token || req.cookies["wto.visitor"];
    let event = Setting_Event || getEvent();

    if(!["1", "2"].includes(event)){
        res.json({
            message: "main stage"
        });
        return;
    }

    console.log(`Event is: ${event}`);

    if(event == "1"){
        let o = allocation.e1;
        let URL = false;

        // Check if user has been previously allocated. If they have, just return that.
        let previousAllocation = o.userAllocation[ uuid ];

        console.log("Previous allocation for uuid: ", uuid, previousAllocation);
        if(previousAllocation !== undefined){
            
            // User's been in this room before:
            URL = config.e1.roomURLs[ previousAllocation ];
            console.log("User assigned back to pre-allocated room# ", previousAllocation, URL);

        } else {
            
            // New allocation. Round-robin ALL users.

            o.nextIndex++; // starts at -1. increment 
            if(!o.rooms[ o.nextIndex ]) o.nextIndex = 0; // if we've gone past the last room, go back to 0
            
            // Store the allocation, so we can look up who's in which room
            o.rooms[ o.nextIndex ].push( uuid );

            // Preserve allocation in hashmap too. Easy lookup for users going back to the same room.
            o.userAllocation[ uuid ] = o.nextIndex; 
    
            URL = config.e1.roomURLs[ o.nextIndex ];
            console.log("User assigned to new room# ", o.nextIndex, URL);
        }
        
        res.json({
            room: URL,
            ts: Date.now()
        });

    } else if(event == "2"){

        let o = allocation.e2;
        let URL = false;

        // check userAllocation 
        let previousAllocation = o.userAllocation[ uuid ];

        console.log("Previous allocation for uuid: ", uuid, previousAllocation);
        if(previousAllocation !== undefined){
            
            // User's been in this room before:
            URL = config.e2.roomURLs[ previousAllocation ];
            console.log("User assigned back to pre-allocated room# ", previousAllocation, URL);

        } else {

            console.log("Assigning new room. Starting with leader allocation check");

            // Check leader allocation
            let leaderAlloc = config.e2.leaderAllocation[ uuid ];
            console.log("Leader allocation: "+leaderAlloc);

            if(leaderAlloc){
    
                // If they're a leader, they'll have pre-allocated rooms. Just send them in there.
                URL = config.e2.roomURLs[ leaderAlloc ];
            
                // Also add the user to our room list 
                o.rooms.leaders[ leaderAlloc ].push(uuid);

                // And to the quick lookup table
                o.userAllocation[ uuid ] = leaderAlloc;
    
            } else {
    
                // Not a leader 
                // Fill-first approach - throw N users into each room. Start to finish.

                let curRoom = o.rooms.delegates[ o.curRoom ];
                if(curRoom.length < config.e2.delegatesPerRoom){

                    // Add user to room 
                    curRoom.push( uuid );

                    // Add user to map 
                    o.userAllocation[ uuid ] = o.curRoom;

                    // Return room 
                    URL = config.e2.roomURLs [o.curRoom];

                } else {

                    o.curRoom++;
                    curRoom = o.rooms.delegates[ o.curRoom ];
                    
                    // If we hit the limit on rooms, i.e. excessive delegates, go back to 0. 
                    // We'll keep hitting this condition probably.
                    if(!curRoom){
                        o.curRoom = 0;
                        curRoom = o.rooms.delegates[ o.curRoom ];
                    }

                    // Add user to room 
                    curRoom.push( uuid );

                    // Add user to map 
                    o.userAllocation[ uuid ] = o.curRoom;

                    // Return room 
                    URL = config.e2.roomURLs [o.curRoom];


                }

            }

        }

        if(URL){
            
            // Return room
            res.json({
                room: URL,
                ts: Date.now()
            });

        } else {

            // Return room
            res.json({
                error: "No rooms found",
                ts: Date.now()
            });

        }

    }
});

app.get('/getRooms', function(req, res, next){
    res.json(allocation); // some front end to call this endpoint and do something creative with the data.
});

// TODO: Nicer output for who's in which room 

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
