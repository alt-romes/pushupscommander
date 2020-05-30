const axios = require('axios');

const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

// Constants
const token = config.bottoken;
const cmdprefix = "?";

const cobtoken = config.cobtoken;
const cobconfig = {
                    headers: {
                        'Cookie': 'cobtoken='+cobtoken
                    }
                }

class Database {
    constructor() {
        this.base_url = config.base_url;
    }
    addPushups(n, userID, serverID) {
        return axios.post(this.base_url + "recordm/recordm/instances/integration", 
            {
                type: 'ROMES Pushups Commander',
                values: {
                    Amount: ""+n,
                    User: ""+userID,
                    Server: ""+serverID
                }
            },
            cobconfig
        );
    }
    getPushups(userID, serverID, timeframe) {
        //Only works for our timezone - should redo if I want to support more timezones
        let q =
        {
            "query": {
                "bool": {
                    "must": [
                        {
                            "query_string": {
                                "query": "user:"+userID+" AND server:"+serverID+(timeframe =="today" ? " AND date.date:now\\/d" : ""),
                                "analyze_wildcard": true
                            }
                        }
                    ],
                    "must_not": []
                }
            },
            "aggs": {
                "soma": {
                    "sum": {
                        "field": "amount"
                    }
                }
            }
        }
        return axios.post(this.base_url + "recordm/recordm/definitions/search/advanced/11?size=0", q, cobconfig).then((r) => {return r.data.aggregations.soma.value;});
    }
}

var db = new Database();

client.once('ready', () => {
	console.log('Ready!');
});

client.login(token);

client.getPushups = function (userID, serverID, timeframe, message, replyending) {
    db.getPushups(userID, serverID, timeframe)
    .then((v) => {
        message.reply("you've done `"+v+"`"+replyending)
    })
    .catch((e) => {
        message.react('👎');
        message.reply(e.message + "\nPlease try again.")
    })
}

client.on('message', message => {
    if (message.content.startsWith("+") || message.content.startsWith("-")) {
        console.log(message.author.username + ": " + message.content);
        let n = parseInt(message.content.slice(1))
        if(Number.isInteger(n) && n != 0) {
            if(message.content.startsWith("-")) n = -n;
            db.addPushups(n, message.author.id, message.guild.id).then(() => {
                if (Math.random() < 0.5) {
                    message.react('🦾');
                } else {
                    message.react('💪');
                }
            }).catch((e) => {
                message.react('👎');
                message.reply("Error: " + e.message + "\nPlease try again.")
            })
        } else
            message.reply("Error: Pushups to add must be a number")
    } else if (message.content.startsWith(cmdprefix)) {

        let cmd = message.content.slice(cmdprefix.length).trim().split(" ")[0];

        if (cmd == "today" || cmd == "t") {
            client.getPushups(message.author.id, message.guild.id, "today", message, "/100 pushups today.");
        } else if (cmd == "all" || cmd == "a") {
            client.getPushups(message.author.id, message.guild.id, null, message, " pushups since you started.");
        } else if (cmd == "server" || cmd == "s") {
            client.getPushups("*", "*", null, message, " pushups alongside everyone in this server.");
        }

    }
});
