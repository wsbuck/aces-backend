const cheerio = require('cheerio');
const fetch = require('node-fetch');
const AWS = require('aws-sdk');

const PITCHERS_TABLE = process.env.PITCHERS_TABLE;
const dynamoDb = new AWS.DynamoDB.DocumentClient();

async function scrapeWebsite(pitchType) {
  let url = `https://legacy.baseballprospectus.com/pitchfx/leaderboards/index.php?hand=&reportType=pfx&prp=P&month=&year=2019&pitch=${pitchType}&ds=velo&lim=0`;
  const players = [];
  await fetch(url)
    .then(res => res.text())
    .then(data => {
      const $ = cheerio.load(data);
      const headerNamesRow = $('#myTable thead tr th');
      const headerNames = [];
      headerNamesRow.each(function (i, el) {
        headerNames.push($(this).text().trim());
      });

      const playerRows = $("#myTable tbody tr");
      // const players = [];
      playerRows.each(function (i, el) {
        let player = $(el).children();
        let playerData = {};
        player.each(function (j, el) {
          let value = $(this).text().trim();
          if (value) {
            playerData[headerNames[j]] = value;
          }
        });
        let name = playerData['Player'];
        let id = (name.split('')[0] + name.split(' ')[1]).toLowerCase();
        playerData['pitcherId'] = id;
        playerData['pitcherName'] = name;
        playerData['type'] = pitchType;
        delete playerData['Player'];
        players.push(playerData);
      });
      // console.log(players);
      // return players;
    });
  return players;
}

async function getAllPlayers() {
  const playerObjects = [];

  let allPlayers = await scrapeWebsite('ALL');
  let fourPlayers = await scrapeWebsite('FA');
  let sinkerPlayers = await scrapeWebsite('SI');
  let cutterPlayers = await scrapeWebsite('FC');
  let curvePlayers = await scrapeWebsite('CU');
  let sliderPlayers = await scrapeWebsite('SL');
  let changePlayers = await scrapeWebsite('CH');


  for (let player of allPlayers) {
    let playerObject = {
      pitcherId: player.pitcherId,
      pitcherName: player.pitcherName,
      ALL: player,
      FA: fourPlayers.find(p => p.pitcherId === player.pitcherId),
      SI: sinkerPlayers.find(p => p.pitcherId === player.pitcherId),
      FC: cutterPlayers.find(p => p.pitcherId === player.pitcherId),
      CU: curvePlayers.find(p => p.pitcherId === player.pitcherId),
      SL: sliderPlayers.find(p => p.pitcherId === player.pitcherId),
      CH: changePlayers.find(p => p.pitcherId === player.pitcherId),
    };
    Object.keys(playerObject).forEach(key => {
      if (playerObject[key] === undefined) {
        // delete playerObject[key];
        playerObject[key] = {Num: 0};
      }
    });
    playerObjects.push(playerObject);
  }
  return playerObjects;
}

async function delFromDb(delArray) {
  const deleteParams = {
    RequestItems: {
      [PITCHERS_TABLE]: delArray
    }
  };

  const delProm = dynamoDb.batchWrite(deleteParams).promise();
  await delProm.then(function (data) {
    console.log('Del Success');
  }).catch(function (err) {
    console.log(err);
  });
}

async function putToDb(putArray) {
  const putParams = {
    RequestItems: {
      [PITCHERS_TABLE]: putArray
    }
  };

  const putProm = dynamoDb.batchWrite(putParams).promise();
  await putProm.then(function (data) {
    console.log('Put Success!');
  }).catch(function (err) {
    console.log(err);
  });
}

module.exports = {
  scrapeWebsite,
  getAllPlayers,
  delFromDb,
  putToDb
};