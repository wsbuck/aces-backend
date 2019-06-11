const { getAllPlayers, delFromDb, putToDb } = require('./helpers');

module.exports.scrape = async (event, context) => {
  await getAllPlayers()
    .then(async players => {
      let deleteItems = [];
      let putItems = [];
      for (let player of players) {
        let deleteItem = {
          DeleteRequest: {
            Key: {
              pitcherId: player.pitcherId
            }
          }
        };
        deleteItems.push(deleteItem);
        
        if (deleteItems.length == 25) {
          await delFromDb(deleteItems);
          deleteItems = [];
        }

        let putItem = {
          PutRequest: {
            Item: player
          }
        };
        putItems.push(putItem);

      if (putItems.length == 25) {
        await putToDb(putItems);
        putItems = [];
      }
    };
    await delFromDb(deleteItems);
    await putToDb(putItems);
    })
    .catch(error => console.error(error));
};