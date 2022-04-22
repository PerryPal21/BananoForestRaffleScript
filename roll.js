// Here I import the dependencies
const StormDB = require("stormdb");
var colors = require("colors");
const fetch = require("node-fetch");

// The local json database is being initialized
const engine = new StormDB.localFileEngine("./storage.json");
const db = new StormDB(engine);
db.default({ totalAmount: 0, weightage: {}, balance: {} });

// Specifying the API address making it easier to change just in case creeper is down
var explorerAddress = "https://api.bananode.eu/v2/accounts/";

// Calculating the date from a week ago using unixtime
// Obviously this script will be used at a designated time in order to ensure that every transaction is counted
var unixtime = Math.floor(Date.now() / 1000) - 604800;
console.log("Unixtime = " + unixtime);

// This array stores the different organization addresses
const addressArr = [
  "ban_3greenxg9oxkaei556wrxwzwdxie4ehmzhmi7fyztofhantxjysntceq5sx5",
  "ban_3green9hp4hg8ejbpiq5fykktaz3scjoop9nzinq8m8kxu1xi6fi5ds3gwm8",
  "ban_3greengegg8of5dqjqfzqzkjkkygtaptn39uyja4xncd13eqftcpw4r4xmfb",
  "ban_3greenp7kzetigfjcfgbis1ad63m4hyyyit9usd1g4byuxg81g79fc8aiwtr",
];

// The postTotal function is pretty self-explanatory
// It fetches the address using the API, sorts through the response to only look at "recieve" transactions
// After that it sorts to make sure that the transactions happen after the date specified
// After all of the sorting it looks through each object and adds the amount recieved to the totalAmount
// The total amount per address is stored in the database
function postTotal(address, timeframe) {
  return fetch(explorerAddress + address + "/history", {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())

    .then((responseData) => {
      var objectrecieve = responseData.filter((obj) => {
        return obj.subtype === "receive";
      });
      var object = objectrecieve.filter((obj) => {
        return parseInt(obj.local_timestamp) > parseInt(timeframe);
      });

      for (var i = 0; i < object.length; i++) {
        if (object[i] === undefined) {
          return;
        } else if (object[i].amount) {
          var storedVal = db.get("totalAmount").value();
          
          db.set(
            "totalAmount",
            storedVal + (object[i].amount / 10 ** 29))
        }
      }
    })
    .catch((error) => console.warn(error));
}

// For the fetchTransactions function, it is very similar to postTotal in which
// it sorts through the api response in the same way

// But instead of adding to a totalAmount it returns the sorted data
// This function is separate from the postTotal function in order to make sure
// that the total is posted before any other part of the code is run

function fetchTransactions(address, timeframe) {
  return fetch(explorerAddress + address + "/history", {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())

    .then((responseData) => {
      return responseData;

    })
    .catch((error) => console.warn(error));
}

// fetchAmount takes the rawinput from the function above and filters through it to get the account and amount sent
// Based on this, it checks the database to make sure whether there is a stored value for this account
// If the value about the amount donated is stored, it adds to that value. Otherwise it creates a new value for the account

function fetchAmount(rawinput, timeframe) {
  var objectrecieve = rawinput.filter((obj) => {
    return obj.subtype === "receive";
  });
  var object = objectrecieve.filter((obj) => {
    return parseInt(obj.local_timestamp) > parseInt(timeframe);
  });

  for (var i = 0; i < object.length; i++) {
    var amount = object[i].amount;
    var account = object[i].account;
    var existingAmount = db.get(`balance.${account}`).value();

    if (object[i] === undefined) {
      return;
    } else if (account) {
      if (existingAmount != undefined) {
        db.set(
          `balance.${account}`,
          db.get(`balance.${account}`).value() +  (amount/10**29)
        ).save(); 

      } else if (existingAmount === undefined) {
        db.set(`balance.${account}`, amount / 10 ** 29).save();
      }
    }
  }
}
// This function gets very similar information but instead it decides the weightage of a person's donation
// It divides the person's donation by how much they donated, resulting in a decimal value which is added to the database
function fetchWeight(Inputobject) {  
  return new Promise((resolve, reject) => {

  var accountArr = Object.getOwnPropertyNames(Inputobject);
  for (var i = 0; i < accountArr.length; i++) {
    var existingWeight = db.get(`weightage.${accountArr[i]}`).value();
    db.set(`weightage.${accountArr[i]}`, db.get(`balance.${accountArr[i]}`).value() / db.get("totalAmount").value()
    ).save();
    

    console.log(
      `Account Name - ${accountArr[i].substring(0, 10)}`.underline.green
    );
    console.log(`Total Amount Donated - ${db.get(`balance.${accountArr[i]}`).value()}`.yellow);
    console.log(
      `Weightage - ${db.get(`weightage.${accountArr[i]}`).value()}`.red
    );
    console.log("\n");
  }
    var weightageObj = db.get("weightage").value();
    resolve(weightageObj);
  })
}

// This is where the magic happens
// This takes in the probability object that we made and returns the value based on the probability
// It is still random, but still influenced by how much a person donates
function weightedRandom(prob) {
  let i,
    sum = 0,
    r = Math.random();
  for (i in prob) {
    sum += prob[i];
    if (r <= sum) return i;
  }
}

// This is a simple function to stop the program for some time, used later on
function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

// This nested system might look weird but it ensures that everything happens in a sequence
// *And yes I know there are better ways to do this, I went for a method that just works*
// The sleep function is used to stop the program from continuing for 3 seconds just so that the total amount can be updated
// Then one by one, it fetches transactions and then fetches the amount
// After getting all of the amounts, it fetches the weight using the stored data in the database
// AND FINALLY WE GET THE WINNER OF THE RAFFLE
postTotal(addressArr[0], unixtime).then((result) => {
  postTotal(addressArr[1], unixtime).then((result) => {
    postTotal(addressArr[2], unixtime).then((result) => {
      postTotal(addressArr[3], unixtime).then((result) => {
        sleep(3000);

        fetchTransactions(addressArr[0], unixtime).then((result) => {
          fetchAmount(result, unixtime);

          fetchTransactions(addressArr[1], unixtime).then((result) => {
            fetchAmount(result, unixtime);

            fetchTransactions(addressArr[2], unixtime).then((result) => {
              fetchAmount(result, unixtime);

              fetchTransactions(addressArr[3], unixtime).then((result) => {
                fetchAmount(result, unixtime);
                var balanceObj = db.get("balance").value()
                fetchWeight(balanceObj).then((result) => {
                  console.log(
                    "Total Amount Donated - " + db.get("totalAmount").value()
                  );
                  console.log(
                    "\n" + weightedRandom(db.get("weightage").value())
                  );
                });
              });
            });
          });
        });
      });
    });
  });
});
