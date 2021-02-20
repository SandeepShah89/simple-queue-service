/* 
    WTO Simple Queue Service - Built for WeWebinar
    
    User stories to fulfill:

    1. When users hit /enter, we work out which event they belong to based on time of day, 

*/

const express = require('express');
let cookieParser = require('cookie-parser');

let fs = require('fs');
let util = require('util');
let debugMode = false;

let req_file = fs.createWriteStream(__dirname + '/requests.txt', {flags : 'a'});
let log_file = fs.createWriteStream(__dirname + '/log.txt', {flags : 'a'});
let err_file = fs.createWriteStream(__dirname + '/errors.txt', {flags : 'a'});

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

const port = 80;

let config = {
    e1: {
        lastRoom: -1,
        rooms: [
            '550-090-099',
            '284-869-116',
            '556-398-013',
            '685-855-244',
            '849-883-863',
            '135-631-640',
            '396-211-528',
            '177-510-464',
            '415-715-758',
            '436-492-167',
            '202-707-096',
            '143-148-894',
            '307-375-231',
            '549-063-767',
            '684-930-078',
            '315-167-491',
            '776-600-344',
            '219-702-766',
            '941-406-000',
            '370-887-601',
            '277-846-441',
            '704-474-483',
            '280-800-015',
            '465-533-446',
            '550-741-371',
            '464-600-589',
            '328-526-600',
            '558-840-745',
            '211-418-658',
            '709-394-464',
            '631-151-773',
            '274-094-669',
            '434-990-949',
            '230-686-534',
            '397-560-220',
            '557-293-691',
            '948-825-982',
            '501-640-781',
            '970-381-166',
            '529-099-236',
            '418-419-555',
            '694-431-015',
            '955-284-888',
            '563-494-405',
            '466-490-918',
            '221-565-573',
            '895-867-485',
            '814-794-501',
            '633-218-235',
            '733-982-222',
            '123-661-941',
            '570-211-217',
            '962-475-404',
            '851-677-317',
            '550-560-365',
            '601-780-522',
            '523-813-665',
            '324-169-211',
            '547-445-463',
            '103-375-307',
            '202-712-227',
            '412-511-256',
            '515-910-780',
            '585-948-918',
            '169-503-919',
            '340-643-638',
            '838-075-911',
            '234-979-776',
            '149-377-048',
            '281-921-721',
            '612-822-054',
            '636-588-602',
            '137-581-198',
            '119-460-442',
            '678-882-406'
        ]
    },
    e2: {
        lastRoom: -1
    }
};

config.e2.rooms = config.e1.rooms.slice(0, 40);

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

    let event = Setting_Event || getEvent();

    if(!["1", "2"].includes(event)){
        res.json({
            room: "901-252-752",
            roomType: 'main stage'
        });
        return;
    }

    console.log(`Event is: ${event}`);

    let thisEvent = config["e"+event];
    thisEvent.lastRoom++;
    let roomID = thisEvent.rooms[ thisEvent.lastRoom ];
    if(!roomID){
        thisEvent.lastRoom = 0;
        roomID = thisEvent.rooms[ thisEvent.lastRoom ];
    }

    res.json({
        room: roomID,
        roomType: 'breakout'
    });

});

app.get('/clearAll', (req, res) => {
    config.e1.lastRoom = -1;
    config.e2.lastRoom = -1;
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

// 2nd breakout session = first 40 rooms 
// we don't need to worry about leaders for e2 

