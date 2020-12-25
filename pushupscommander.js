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
    addExercise(n, userID, serverID, username, type) {
        return axios.post(this.base_url + "recordm/recordm/instances/integration", 
            {
                type: 'ROMES Pushups Commander',
                values: {
                    Name: ""+username,
                    Amount: ""+n,
                    User: ""+userID,
                    Server: ""+serverID,
                    Type: ""+type
                }
            },
            cobconfig
        );
    }
    getPushups(userID, serverID, timeframe, type) {
        //Only works for our timezone - should redo if I want to support more timezones
        let q =
        {
            "query": {
                "bool": {
                    "must": [
                        {
                            "query_string": {
                                "query": "user:"+userID+" AND server:"+serverID+(timeframe =="today" ? " AND date.date:now\\/d" : "") + " AND type:"+type,
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
        return axios.post(this.base_url + "recordm/recordm/definitions/search/advanced/11?size=0", q, cobconfig).then((r) => {return r.data.aggregations["sum#soma"].value;});
    }
}

var db = new Database();

client.once('ready', () => {
	console.log('Ready!');
});

client.login(token);

client.getPushups = function (userID, serverID, timeframe, message, replyending, type) {
    db.getPushups(userID, serverID, timeframe, type)
    .then((v) => {
        console.log(v)
        message.reply("you've done `"+v+"`"+replyending)
    })
    .catch((e) => {
        message.react('👎');
        message.reply(e.message + "\nPlease try again.")
    })
}

function getType(content) {

    let type=null

    if(content.length == 1 || content[1] == "p" || content[1] == "pushups")
        type = "pushups"
    else if (content[1] == "km" || content[1] == "kilometers")
        type = "kilometers"
    else if (content[1] == "a" || content[1] == "abs")
        type = "abs"
    else if (content[1] == "s" || content[1] == "squats")
        type = "squats"

    return type
}

client.on('message', message => {
    if (message.content.startsWith("+") || message.content.startsWith("-")) {
        let content = message.content.split(" ")
        let n = parseFloat(content[0].slice(1)) // parseInt apparently splits on space
        if(typeof n === "number" && n != 0) {
            if(message.content.startsWith("-")) n = -n;


            let type = getType(content)

            console.log(n, message.author.id, message.guild.id, message.author.username, type)
            if (type != null)
                db.addExercise(n, message.author.id, message.guild.id, message.author.username, type).then(() => {
                    if (Math.random() < 0.5) {
                        message.react('🦾');
                    } else {
                        message.react('💪');
                    }
                }).catch((e) => {
                    message.react('👎');
                    message.reply("Error: " + e.message + "\nPlease try again.")
                })
            else
                message.reply('Type of exercise not recognized. Use "abs", "km", "squats" or "pushups" (if not specified, it counts as pushups)')

        } else
            message.reply("Error: Pushups to add must be a number")
    } else if (message.content.startsWith(cmdprefix)) {

        let content = message.content.slice(cmdprefix.length).trim().split(" ")
        let cmd = content[0]
        let type = getType(content)
        if (type==null) type="pushups"

        if (cmd == "today" || cmd == "t") {
            client.getPushups(message.author.id, message.guild.id, "today", message, " "+type+" today.", type);
        } else if (cmd == "all" || cmd == "a") {
            client.getPushups(message.author.id, message.guild.id, null, message, " "+type+" since you started.", type);
        } else if (cmd == "server" || cmd == "s") {
            client.getPushups("*", "*", null, message, " "+type+" alongside everyone in this server.", type);
        }

    }
});
