#!/usr/bin/env node

const pr = require('properties-reader');
const tmi = require('tmi.js');
const pb = require('@madelsberger/pausebuffer');

const getBatchManager = require('./lib/batcher.js');
const getChatCommands = require('./lib/chatCommands.js');
const getWhisperCommands = require('./lib/whisperCommands.js');


let properties = pr(process.argv[2] || './kihunter.properties').path();

// unpack the properties we'll need
const locationcount = +properties.core.locationcount;
const channels = properties.tmijs.channels.split(/\s*,\s*/);
const identity = properties.tmijs.identity;
const expectmod = (properties.chat.expectmod == 'true');
const cp = properties.chat.commandprefix;


// key hunt state
let huntState = {};

for (const channel of channels) {
  huntState[`#${channel}`] = {
    isOpen: false 
  , guesses: [] 
  , guessers: {} 
  , remaining: locationcount
  };
}


// Event handlers
function onChatHandler (channel, user, msg, self) {
  if (!self && (msg.substr(0, 1) === cp)) {
    let parse = msg.slice(1).split(' ');
    let commandName = parse[0];
    let params = parse.splice(1);

    if (commandName in chatCommands) {
      chatCommands[commandName](channel, user, params);
      console.log(
        `* Executed ${commandName} chat command for ${user.username}`);
    }
  }
}

function onWhisperHandler (from, user, msg, self) {
  if (!self && (msg.substr(0, 1) === cp)) {
    let parse = msg.slice(1).split(' ');
    let commandName = parse[0];
    let params = parse.splice(1);

    if (commandName in whisperCommands) {
      whisperCommands[commandName](from, user, params);
      console.log(
        `* Executed ${commandName} whisper command for ${user.username}`);
    }
  }
}

function onConnectedHandler (addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}

function onDisconnectedHandler (reason) {
  console.log(`Disconnected: ${reason}`);
  process.exit(1);
}


// **** MAINLINE ****

let client = pb.wrap(new tmi.client({identity: identity, channels: channels}));
client.setLowPriorityTimeout(5);
if (expectmod) {
  client.setMessageCountLimit(120); // still well under mod limit, but plenty
  client.setThrottle({low: 250});
}

const batchManager = getBatchManager(properties, client);
const chatCommands = getChatCommands(
                                  properties, client, huntState, batchManager);
const whisperCommands = getWhisperCommands(
                                  properties, huntState, chatCommands);

client.on('chat', onChatHandler);
client.on('whisper', onWhisperHandler);
client.on('connected', onConnectedHandler);
client.on('disconnected', onDisconnectedHandler);

client.connect();
