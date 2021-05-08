const socket = io("ws://localhost:8080");
'use strict';

/*
  * REGISTER BUTTON
*/
async function setNickname(){
  try {
    var onlineUsersList = document.querySelector("#messages");
    var OffOnInfo = document.querySelector("#OffOnInfo");
    var OfflineMessageUserList = document.querySelector("#OfflineMessageUserList");
    var OfflineMessageList = document.querySelector("#OfflineMessagesList");
    onlineUsersList.innerHTML = "";
    OffOnInfo.innerHTML = "";
    OfflineMessageUserList.innerHTML = "";
    OfflineMessageList.innerHTML = "";
    let nick = document.querySelector("#nick");
    if(["",null].includes(nick.value)){
      alert("Nickname can not be empty!");
    }
    else if(!socket.connected){
      alert("Socket connection not found!"); 
    }
    else{
      await socket.emit("ChatRegister",nick.value);
    }
    /*
      * ALL USERS
    */
    await socket.emit("GetAllUsers",nick.value);
    globalThis.nick = `${nick.value}`;
    nick.value = "";
  } catch (err) {
    console.log(err.message);
  }
}
socket.on("GetAllUsersResponse",async (msg) => {
  var allUsersList = document.querySelector("#allUsersList");
  allUsersList.innerHTML = "";
  for(let arg of msg){
    allUsersList.innerHTML += `<button onclick="getMessageTopTen('${arg.nickname}')">${arg.nickname}</button> `;   
  }
});
async function getMessageTopTen(nickname) {
  try {
    document.querySelector("#allUsersMessageList").innerHTML = "";
    socket.emit("AllUsersMessageList",nickname);
  }
  catch (err) {
    console.log(err.message);
  }
}
socket.on("AllUsersMessageListResponse", async (msg) => {
  var topTenMessage = document.querySelector("#allUsersMessageList");
  for(let arg of msg){
    var date = new Date(arg.messages.Timestamp);
    topTenMessage.innerHTML += `<li>${arg.messages.From} ${date.getFullYear()+"-"+date.getMonth()+"-"+date.getDate()+"  "+date.getHours()+":"+date.getMinutes()} Tarihli mesajı --> ${arg.messages.msg}</li> <br>`;
  }
});
socket.on("UserDisconnected",async function(msg,offlineUser) {  
  var onlineUsersList = document.querySelector("#onlineUsersList");
  onlineUsersList.innerHTML = msg.sort();
  var OffOnInfo = document.querySelector("#OffOnInfo");
  OffOnInfo.innerHTML += `<li>${offlineUser} went offline</li>`;
});
socket.on("ChatRegisterAdd", function(msg) {
  alert(msg.msg);
});
socket.on("ChatMessageTargetError", function(msg) {
  alert(msg.msg);
});
socket.on("ChatMessagesError", function(msg) {  
  alert(msg.msg);
});
socket.on("ChatRegisterResponse", function(msg,onlineUser) {
  var onlineUsersList = document.querySelector("#onlineUsersList");
  onlineUsersList.innerHTML = msg.sort();
  var OffOnInfo = document.querySelector("#OffOnInfo");
  OffOnInfo.innerHTML += `<li>${onlineUser} went online</li>`;
});
socket.on("OfflineMessages", function(msg){
  for(let user of msg){
    document.querySelector("#OfflineMessageUserList").innerHTML += `<button onclick="getMessagesFrom('${user._id}')">${user._id}</button><button>${user.count}</button> `;
  }
});
async function getMessagesFrom(From){
  try {
    document.querySelector("#OfflineMessagesList").innerHTML = "";
    await socket.emit("GetUnreadFrom",From);
  }
  catch (err) {
    console.log(err.message);
  }
}
socket.on("GetUnreadFromResponse",function(msg) {
  for(let message of msg){
    var date = new Date(message.messages.Timestamp);
    document.querySelector("#OfflineMessagesList")
    .innerHTML += `<li>${message.messages.From} ${date.getFullYear()+"-"+date.getMonth()+"-"+date.getDate()+"  "+date.getMinutes()+":"+date.getHours()} Tarihli mesajı --> ${message.messages.msg}</li> <br>`;
  }
});
/*
  * SEND MESSAGE BUTTON
*/
async function sendMsg(){
  try {
    if(typeof(globalThis.nick) == 'string'){
      let msg = document.querySelector("#messagebox");
      var selectedUser = document.querySelector("#selectedUser");
      if(["",null,undefined].includes(msg.value) || ["",null,undefined].includes(selectedUser.value)){
        alert("Message and Selected user can not be empty!");
      }
      else{
        await socket.emit('ChatMessage',{
          target: selectedUser.value,
          message: msg.value
        });
        var messages = document.querySelector("#messages");
        messages.innerHTML += `<li>${JSON.stringify(globalThis.nick)}"-->"${JSON.stringify(msg.value)}</li>`;
        selectedUser.value = "";
        msg.value = "";
      }
    }
    else{
      alert("Active user not found!");
    } 
  }
  catch (err) {
    console.log(err.message);
  }
}
let messages = document.querySelector("#messages"); 
socket.on("ChatMessageResponse",(msg)=>{
  messages.innerHTML += `<li>${JSON.stringify(msg.sender)}"-->"${JSON.stringify(msg.message)}</li>`;
});
/*
  * SOUFFLE MESSAGE BUTTON
*/
async function sendSouffle(){
  let msg = document.querySelector("#messagebox");
  var selectedUser = document.querySelector("#selectedUser");
  if(["",null,undefined].includes(msg.value) || ["",null,undefined].includes(selectedUser.value)){
    alert("Message and Selected user can not be empty!");
  }
  else{
  await socket.emit('SouffleMessage',{
    target: selectedUser.value,
    message: msg.value
  });
  var messages = document.querySelector("#messages");
  messages.innerHTML += `<p>Sent to ${selectedUser.value}</p><li>SouffleMessage: ${msg.value}</li>`;

  msg.value = "";
  selectedUser.value = "";
  }
}
socket.on("SouffleMessageResponse", async (msg) => {
  alert(`SOUFFLE! ${JSON.stringify(msg.sender)} --> ${JSON.stringify(msg.message)}`);
});
socket.on("SouffleTest",async (msg) => {
  alert(msg);
})
/*
  * ANNOUNCEMENT BUTTON
*/
async function sendAnnouncement(){
  let msg = document.querySelector("#messagebox");
  if(["",null,undefined].includes(msg.value)){
    alert("Message can not be empty!");
  }
  else{
    await socket.emit('AnnouncementMessage',{
      message: msg.value
    });
    var messages = document.querySelector("#messages");
    messages.innerHTML += `<li>Announcement sent to all users: ${msg.value}</li>`;
    msg.value = "";
  }
}
socket.on("AnnouncementMessageResponse",(msg)=>{
  alert(`DUYURU! ${JSON.stringify(msg.sender)} --> ${JSON.stringify(msg.message)}`);
});
/*
  * NOTE BUTTON
*/
async function takeNote(){
  let msg = document.querySelector("#messagebox");
  if(["",null,undefined].includes(msg.value)){
    alert("Message can not be empty!");
  }
  else{
    await socket.emit('takeNote',{
      message: msg.value
    });
    msg.value = "";
  }
}
socket.on("takeNoteResponse",msg => {
  console.log(msg.n);
  if(msg.n == 1 && msg.ok == 1){
    alert("successfully noted");
  }
});
