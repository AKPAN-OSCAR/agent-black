/* ============================================
   DELTA BLACK — FIREBASE CONFIGURATION
   ============================================ */
const firebaseConfig = {
    apiKey:            "AIzaSyD9VfTiw9iFWhU--fYX942emBSb4e_qf-Y",
    authDomain:        "delta-black.firebaseapp.com",
    databaseURL:       "https://delta-black-default-rtdb.firebaseio.com",
    projectId:         "delta-black",
    storageBucket:     "delta-black.firebasestorage.app",
    messagingSenderId: "234359575399",
    appId:             "1:234359575399:web:b0a1eab414f39e746155c2",
    measurementId:     "G-EV1WXZK6VS"
};

firebase.initializeApp(firebaseConfig);

const DB      = firebase.database();
const STORAGE = firebase.storage();

console.log('[Delta Black] Firebase initialised — project: delta-black');

/* DB_Ref — all Firebase path shortcuts */
const DB_Ref = {
    users:          function()   { return DB.ref('users'); },
    user:           function(id) { return DB.ref('users/' + id); },
    questions:      function()   { return DB.ref('questions'); },
    question:       function(id) { return DB.ref('questions/' + id); },
    responses:      function()   { return DB.ref('responses'); },
    response:       function(id) { return DB.ref('responses/' + id); },
    messages:       function()   { return DB.ref('messages'); },
    conversation:   function(id) { return DB.ref('messages/' + id); },
    message:        function(cId,mId){ return DB.ref('messages/' + cId + '/msgs/' + mId); },
    alerts:         function()   { return DB.ref('alerts'); },
    alert:          function(id) { return DB.ref('alerts/' + id); },
    activity:       function(ag) { return DB.ref('activity/' + ag); },
    activityItem:   function(ag,id){ return DB.ref('activity/' + ag + '/' + id); },
    userdata:       function(ag) { return DB.ref('userdata/' + ag); },
    userdataItem:   function(ag,id){ return DB.ref('userdata/' + ag + '/' + id); },
    receipts:       function(qId){ return DB.ref('receipts/' + qId); },
    receipt:        function(qId,ag){ return DB.ref('receipts/' + qId + '/' + ag); },
    welcomeMessage: function()   { return DB.ref('config/welcomeMessage'); },
    settings:       function()   { return DB.ref('config'); }
};
