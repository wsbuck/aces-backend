const cheerio = require('cheerio');
const fetch = require('node-fetch');

async function scrapeWebsite(url, pitchType) {
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
        let id = (name.split('')[0] + name.split(' ')[1] + 
                  '_' + pitchType).toLowerCase();
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
module.exports = {
  scrapeWebsite
};