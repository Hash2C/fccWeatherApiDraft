var request = require("request");
var path = require("path");

var express = require("express");
var app = express();

var requestTimes = [];
var weatherAPI =
  "http://api.openweathermap.org/data/2.5/weather?units=metric&appid=" +
  process.env.OPEN_WEATHER_API_KEY;

function isReqCoordinatesValid(coords) {
  /*
    what is the format of these variables?
    let's assume they are positive decimal numbers
  */

  /*
    for future reference - https://www.nhc.noaa.gov/gccalc.shtml
    
    latitude - is a number; between 90 N and 90 S = -90 N
    longitude - is a number; between 180 W and 180 E = -180 W 
    
    if any var is not a number: throw error 

    if the variables are not provided in the range we can:
    1) throw error ("Values out of range......")
    2) use some mod(variable) value ?? I doubt it
  */
  if (!isNaN(coords.longitude) && !isNaN(coords.latitude)) {
    /*
      for future reference
      https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/isNaN
      https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isNaN
      
      TODO: check this; for now let's assume this is enough validation
    */
    return true;
  }
  return false;
  //return !isNaN(longitude) && !isNaN(latitude);
}

function getNearestMapNodeFromCoordinates(coords) {
  /*let assume (and hardcode for now) that accuracy _acc = 1*/
  var _acc = 1;
  var multiplier = Math.pow(10, _acc.toString().split(".")[0].length); //this is done so we work with integers
  var tempLat = Math.round(coords.latitude * multiplier);
  var tempLon = Math.round(coords.longitude * multiplier);
  var mapNode = { latitude: tempLat, longitude: tempLon };
  console.log("MapNode:", mapNode)
  
  return mapNode;
  /*TODO: i'm very sleepy, go sleep and then solve this; it should return 4, 4, it is returning 4, 0 
 {
  var coords = {latitude: 0.28764353, longitude: 0.223453}
  var _acc = 1;
  var multiplier = Math.pow(10, _acc.toString().split(".")[0].length);
  
  var tempLat = Math.round(coords.latitude * multiplier);
  var tempLatModAcc = tempLat % _acc;
  var newLat = tempLatModAcc <= _acc/2 ? tempLat - tempLatModAcc : tempLat + _acc - tempLatModAcc;
  
  var tempLon = Math.round(coords.longitude * multiplier);
  var tempLonModAcc = tempLon % _acc;
  var newLon = tempLonModAcc <= _acc/2 ? tempLon - tempLonModAcc : tempLon + _acc - tempLonModAcc;
  console.log(newLat,newLon);
  }
  */
}

function getBestCachedData(coords) {
  //this should be ASYNC
  var fs = require("fs");
  var obj = JSON.parse(
    fs.readFileSync("./data/cachedApiResponses.json", "utf8")
  );
  console.log("All cached data:", obj);
  console.log("The desired data:", obj.map[`${coords.longitude},${coords.latitude}`]);
  return obj.map[`${coords.longitude},${coords.latitude}`];
}

function addToCache(data) {
  console.log("Add data to cache");
  //For now does nothing. We aren't saving data.
}
/*Not sure about this function
function removeDatesOlderThan(milliseconds) {
  for (var i = 0; i < requestTimes.length; ++i) {
    if (Date.now() - requestTimes[i] > milliseconds) {
      requestTimes.splice(i, 1);
    }
  }
}
*/
var cors = require("cors");
app.use(cors({ optionSuccessStatus: 200 }));

app.get("/", function(req, res) {
  res.sendFile(path.join(__dirname + "/views/index.html"));
});

app.get("/api/current", function(req, res) {
  console.log("starting api request");
  var coords = { latitude: req.query.lat, longitude: req.query.lon };
  var callback = req.query.callback; //not sure what this is

  if (!isReqCoordinatesValid(coords)) {
    console.log("coordenates are wrong")
    return res.json({ error: "Error message because coordinates are in the wrong format or are non-existent" });
  }

  var url = weatherAPI + "&lon=" + coords.longitude + "&lat=" + coords.latitude;

  /*
    removeDatesOlderThan(60000);
    we will not do this on every request
    
    60000 is 1 minute. It's OKish if it's for testing. But for testing we can make it smaller.
    
    In production, maybe we can consider a bigger interval for updating. by hour (and see how it behaves)***?
    
      *** what would be the biggest value acceptable, considering weather forecasts might not be changing that much?
      
  */

  if (requestTimes.length < 60) {
    //can't understand this. does it have to do with concurrency? the server can't handle more than 60 requests?
    // maybe 60 is the weather API limit, per minute!

    // ANYWAY, WE WILL GET RID OF THIS; WE WILL PROVIDE THE BEST POSSIBLE ANSWER

    /*
      if that's the case, we can make 3600 call's per hour [maybe we should try to increase this number, are there other APIs?]
      
      let's do some math:
        1) Calculating distances between 2 points
          If we assume that the coordinates are rounded to 1 decimal digit (e.g. 0.0, 0.1, 1.1, 1.2, 10.1, 179.9)
          If _amp = 0.1;
          the distance abs( (latitude, longitude) - (latitude + _amp, longitude + _amp) )
            - has a maximum of 16km near the equator (a)
            - has a minimum of 11km near the poles   (b)
            
          that means we can define approximatly [-180.0, 180.0] x [-90.0, 90.0] = 6.480.000 areas around the globe,
          each having between (a) 11.31 and (b) 7.78 km squared
          this means we provide accuraty, _min_acc, to a minimum of 16km / 2 = 8km;
          this also means that we probably can increase the value of _amp
          if _amp = 0.4 then _min_acc = 63km / 2 = 31km, which seems reasonable;
          [we can even increase _amp when the number of available requests decreases, so we hit the cache more time]
          
          [OpenWeather says it has data on over 200.000 cities, from more than 40,000 weather stations]
          
          This may be a feasable approach.
          
          The distribution of the coordinates of the requests migth not be uniform;
          it is expected that some areas have a lot of requests (e.g. large urban centers, during daytime)
          and others almost none (e.g. South Pole)
          [We could even use some statistical approach, in order to stablish priority in cache renewal; that would be interesting!]
        
    */

    /*
      requestTimes.push(new Date());
      //we will avoid this
    */

    /*
      We are assuming that the proxy on our server allows this client to make the request
    */

    /*
      Let's convert (latitude, longitude) to XX,X format and hit our cache - which should probably be a DataBase, like MongoDB ****
        ****side note: this MongoDB should be fed by another service, that should use a priority queue, so we can fully use every External API calls.
    */

    var newCoords = getNearestMapNodeFromCoordinates(coords);

    var dataFromCache = getBestCachedData(newCoords);
    console.log("dataFromCache:", dataFromCache);
    /*
    replaceIconsWithLinks(data);
    if (callback) {
      res.jsonp(data);
    } else {
      res.json(data);
    }
    */
    var dataToSend;
    if(dataFromCache) { //if not null
      console.log("If dataFromCache",Date.now());
      //we must check the timestamp!
      if(Date.now() - dataFromCache.dt < 3600000) {//if dt in miliseconds, 3600000ms = 1h
        console.log("Sending data from cache, because timestamp is fine", dataFromCache);
        return res.json(dataFromCache);
      }
      dataToSend = dataFromCache;
    } else {
      dataToSend = {mockingData: "thisIsThatKindOfData"};
      console.log("setting mockingData because we failed do get data from cache", dataToSend);
    }
     //testing request, should be async
    const url2 = "https://jsonplaceholder.typicode.com/todos/1";
    request.get(url2, (error, response, body) => {
      if(error) {
        console.log("Sending mocking data because of error in api. Error from API: ", error);
        return res.json(dataToSend);
      }
      let json = JSON.parse(body);
      console.log("SEND body:", body);
      console.log("SEND json:", json);

      return res.json(json);

    }); //and then store it in cache
    

    /*
    request(url, function(err, resAPI, body) {
      if (err) {
        console.log(err);
      }
      var data = JSON.parse(body);
      if (data.cod != 200) {
        var codError = data.cod;
        console.log("COD ERROR:" + codError);
        console.log("ERROR:" + err);
        console.log("RESPONSE ERROR:" + JSON.stringify(resAPI));
        console.log("BODY:" + body);
        console.log("DATA:" + JSON.stringify(data));
        console.log("REQUEST:" + req.body);
        console.log("REQUESTED URL:" + url);
      }
      if (data.hasOwnProperty("weather")) {
        addToCache(data);
      } else {
        data = getBestCachedData(longitude, latitude);
        console.log(data);
      }
      replaceIconsWithLinks(data);
      if (callback) {
        res.jsonp(data);
      } else {
        res.json(data);
      }
    });
    */
  }
});

app.listen(process.env.PORT || 3000, function() {
  console.log(`App is listening on port ${process.env.PORT || 3000}`);
});
