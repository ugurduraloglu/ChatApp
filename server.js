const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
var express = require("express");
var cors = require('cors');

const url = 'mongodb://localhost:27017';

const dbName = 'db';
var mongo;
var user;
var messages;
var announcements;
var soufflemessages;
var offlinemessages;
const client = new MongoClient(url,{ useUnifiedTopology: true });
client.connect(function(err) {
  assert.strictEqual(null, err);
  console.log('Connected successfully to server');

  mongo = client.db(dbName);
  user = mongo.collection('users');
  messages = mongo.collection('messages');
  announcements = mongo.collection('announcements');
  soufflemessages = mongo.collection('soufflemessages');
  offlinemessages = mongo.collection('offlinemessages');
});
var app = express();
var http = require("http");
var server = http.createServer(app);
var io = require("socket.io")(server,{
  cors: 
  {
  origin: "http://127.0.0.1:5500",
  methods: ["GET", "POST"],
  }
});

app.use(cors());
app.use(express.static(__dirname));
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(express.json()); 

var  users = new Map();
globalThis.users = users;
io.on('connection',async (socket) => {

  socket.on("disconnect",()=>{
    try {
      var deleteUser = users.get(socket.id);
      users.delete(socket.id);
      io.emit("UserDisconnected",Array.from(users.values()),deleteUser);
    }
    catch (err) {
      console.log(err.message);
    }
  });
  if(socket.connected){
    /*
      * REGISTER
    */
    socket.on("ChatRegister",async (msg) => {
      try {
        users.set(socket.id,msg);
        var userLogin = users.get(socket.id);
        var userTest = await user.findOne({nickname:userLogin});
        if(userTest){
          var userTest = await offlinemessages.findOne({nickname:userLogin});
          if(userTest){
            var offlineMessages = await offlinemessages.aggregate([
              {$match: {"nickname": userLogin }},
              {$unwind:"$messages"}, 
              {$group: {
                _id: "$messages.From",
                count: {$sum: 1}
              }}
            ]).toArray();
            socket.emit("OfflineMessages",offlineMessages);
          }
        }else{
          await user.insertOne({nickname:userLogin});
          socket.emit("ChatRegisterAdd",{msg:"New user added"});
        }
        io.emit("ChatRegisterResponse",Array.from(users.values()),userLogin);
      }
      catch (err) {
        console.log(err.message);
      }
    });
    socket.on("GetAllUsers",async (msg) => {
      try {  
        var userList = await user.find().toArray();
        await socket.emit("GetAllUsersResponse",userList);
      }
      catch (err) {
        console.log(err.message);
      }
    });
    socket.on("AllUsersMessageList",async (msg) => {
      try {
        var chat_id = Buffer.from([users.get(socket.id), msg].sort().join('')).toString('base64');
        var topTenMessage = await messages.aggregate([
          { $match: {chat_id:chat_id}},
          { $unwind: '$messages'},
          { $sort: {'messages.Timestamp': -1}},
          { $limit: 10}
        ]).toArray();
        console.log(topTenMessage);
        socket.emit("AllUsersMessageListResponse",topTenMessage);
      }
      catch (error) {
        console.log(error.message);
      }
    });
    /*  
      * ONLİNE and OFLİNE MESSAGING 
    */ 
    socket.on("ChatMessage",async (msg)=>{
      try {
        if(msg.target == users.get(socket.id)){
          socket.emit("ChatMessagesError",{msg:"Nickname and Selected user can not be the same"});
        }else{
          var docs = await user.findOne({nickname:msg.target});
            if(docs){
              var usertest = Array.from(users.values()).find(function (element) { // Online users 
                return element == msg.target;
              });
              if( usertest == msg.target){ 
                var target_socket = Array.from(users.entries()).find(user => user[1] == msg.target)[0];
                var chat_id = Buffer.from([users.get(socket.id), msg.target].sort().join('')).toString('base64');
                await messages.updateOne(
                  { chat_id: chat_id , persons: [users.get(socket.id),msg.target].sort()},
                  {
                    $push:{
                      messages:{
                        From: users.get(socket.id),
                        To: msg.target,
                        Timestamp: (new Date()).getTime(),
                        msg: msg.message
                      }
                    }
                  },
                  {upsert:true}
                );
                io.of('/').sockets.get(target_socket).emit("ChatMessageResponse",
                {
                  sender: users.get(socket.id),
                  message: msg.message,
                  chat_id: chat_id
                });
              }
              else{
                await offlinemessages.updateOne(
                  { nickname:msg.target },
                  {
                    $push:{
                      messages:{
                        From: users.get(socket.id),
                        Timestamp: (new Date()).getTime(),
                        msg: msg.message
                      }
                    }
                  },
                  {upsert:true}
                );
              }
            }else{
              socket.emit("ChatMessageTargetError",{msg:"Selected user not found"});
            }
        }
      }
      catch (error) {
        console.log(error.message);
      }
    });
    socket.on("GetUnreadFrom",async function(From) {
      try {
        var To = users.get(socket.id);
        var chat_id = Buffer.from([To, From].sort().join('')).toString('base64');
        var messagess = await offlinemessages.aggregate([
          {$unwind:"$messages"}, 
          {$match: {"messages.From": From,"nickname":To}}
          ]).toArray();
        await socket.emit("GetUnreadFromResponse",messagess);
        for(let arg of messagess){
          await messages.updateOne(
            { chat_id: chat_id , persons: [From,To].sort()},
            {
              $push:{
                messages:{
                  From: From,
                  To: To,
                  Timestamp: arg.messages.Timestamp,
                  msg: arg.messages.msg
                }
              }
            },
            {upsert:true}
          );
        }
        var user = await offlinemessages.findOne({nickname: To});
        var filterArray = user.messages.filter(function (value) {
          return value.From != From ;
        });
        await offlinemessages.updateOne(
          {nickname: To},
          {
            $set:{
              nickname: To,
              messages: filterArray
            }
          }
        );
        var offlineMessageControl = await offlinemessages.findOne({nickname: To});
        if(offlineMessageControl.messages[0] == null){
          await offlinemessages.deleteOne({nickname:To});
        }
      }
      catch (error) {
        console.log(error.message);
      }
    });
    /*
      * SOUFFLE MESSAGES
    */
    socket.on("SouffleMessage",async (msg) => {
      try {
        users.set(socket.id,users.get(socket.id));
        var onlineUsers = Array.from(users.values());
        var test = onlineUsers.find(function (arg) {
          return arg == msg.target;
        });
        if(test == msg.target){
          var target_socket = await Array.from(users.entries()).find(user => user[1] == msg.target)[0];
          var chat_id = Buffer.from([users.get(socket.id), msg.target].sort().join('')).toString('base64');
          await soufflemessages.updateOne(
            {chat_id: chat_id, persons: [users.get(socket.id),msg.target].sort()},
            {
              $push:{
                messages:{
                  From: users.get(socket.id),
                  To: msg.target,
                  Timestamp: (new Date()).getTime(),
                  msg: msg.message
                }
              }
            },
            {upsert:true}
          );
          io.of('/').sockets.get(target_socket).emit("SouffleMessageResponse",
          {
            sender: users.get(socket.id),
            message: msg.message
          });
        }
        else{
          socket.emit("SouffleTest","User is not online!");
        }
      }
      catch (error) {
        console.log(error.message);
      }
    });
    /*
      * ANNOUNCEMENT MESSAGES
    */
    socket.on("AnnouncementMessage", async (msg) => {
      try {
        await announcements.updateOne(
          {sender: users.get(socket.id)},
          {
            $push:{
              announcements:{
                Timestamp: (new Date()).getTime(),
                msg: msg.message
              }
            }
          },
          {upsert:true}
        );
        await socket.broadcast.emit("AnnouncementMessageResponse",
        {
          sender: users.get(socket.id),
          message: msg.message
        });
      }
      catch (error) {
        console.log(error.message);
      }
    });
    /*
      * NOTE MESSAGES
    */
    socket.on("takeNote",async (msg) => {
      try {
        var chat_id = Buffer.from([users.get(socket.id), users.get(socket.id)].sort().join('')).toString('base64');
        var a = await messages.updateOne(
          { chat_id: chat_id , persons: [users.get(socket.id),users.get(socket.id)]},
          {
            $push:{
              messages:{
                From: users.get(socket.id),
                To: users.get(socket.id),
                Timestamp: (new Date()).getTime(),
                msg: msg.message
              }
            }
          },
          {upsert:true}
        );
        socket.emit("takeNoteResponse",a.result);
        console.log(a.result);
      }
      catch (err) {
        console.log(err.message);
      }
    });
  }
  else{
    console.log("no socket connection");
  }
});
server.listen(8080, () => {
  console.log("server is running on port 8080");
});
