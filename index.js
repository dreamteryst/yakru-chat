var cors = require('cors')
var app = require('express')()
app.use(cors())
const https = require('https');
var http = require('http').Server(app)
var io = require('socket.io')(http)
var port = process.env.PORT || 3000
var axios = require('axios')
const HOST = 'https://yakru.test'

const instance = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});

var time = {}
var exam = {}
var index = {}
var examTime = {}

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html')
})

io.on('connection', function(socket) {
  socket.on('initialize', function(roomId) {
    socket.roomId = roomId
    initTime(roomId)
    socket.on(roomId + '/chat message', function(msg) {
      const payload = {
        user_id: msg.user_id,
        name: msg.name,
        message: msg.message,
        time: `${time[roomId].minutesLabel}:${time[roomId].secondsLabel}`
      }
      io.emit(
        roomId + '/chat message',
        payload
      )
    })

    socket.on(roomId + '/request share screen', function(userId) {
      socket.broadcast.emit(roomId + '/request share screen', userId)
    })
    socket.on(roomId + '/user response', function(data) {
      socket.broadcast.emit(roomId + '/user response', data)
    })
    socket.on(roomId + '/stop student screen', function(data) {
      socket.broadcast.emit(roomId + '/stop student screen', data)
    })

    socket.on(roomId + '/start exam', function(data) {
        exam[roomId] = data
        exam[roomId]['users'] = []
        socket.broadcast.emit(roomId + '/start exam')
    })

    socket.on(roomId + '/join exam', function(user) {
      console.log(user.firstname + " joined room")
      const tempUser = {...user}
      tempUser.point = 0
      exam[roomId].users.push(tempUser)
    })
    socket.on(roomId + '/next exam', function(data) {
      index[roomId] = data.i
      const question = {...exam[roomId].question[data.i]}
      question.time = data.time
      examTime[roomId] = data.time
      delete question.ans

      socket.broadcast.emit(roomId + '/next exam', question)

      if(data.i + 1 == exam[roomId].question.length) {
        setTimeout(() => {
          io.emit(roomId + '/end exam', exam[roomId].user)
        }, data.time * 60 * 1000)
      }
    })
    socket.on(roomId + '/answer exam', function(data) {
      console.log('answer')
      if (exam[roomId].question[index[roomId]].ansText == data.text) {
        const user = exam[roomId].users.find(user => user.id == data.user.id)
        user.point += (data.timeLeft * 1000) / examTime[roomId]
      }
      io.emit(roomId + '/result exam', exam[roomId].users)
    })
    socket.on(roomId + '/end exam', function () {
      io.emit(roomId + '/end exam', exam[roomId].user)
    })

  })
  socket.on('start stream', function() {
    socket.interval = setInterval(function() {
      setTime(socket.roomId)
    }, 1000)
  })

  socket.on('disconnect', function() {
    clearInterval(socket.interval)
  })
})

http.listen(port, function() {
  console.log('listening on *:' + port)
})

function initTime(roomId) {
  time[roomId] = {
    totalSeconds: 0,
    minutesLabel: '00',
    secondsLabel: '00'
  }
}

function setTime(roomId) {
  ++time[roomId].totalSeconds
  time[roomId].secondsLabel = pad(time[roomId].totalSeconds % 60)
  time[roomId].minutesLabel = pad(parseInt(time[roomId].totalSeconds / 60))
}

function pad(val) {
  var valString = val + ''
  if (valString.length < 2) {
    return '0' + valString
  } else {
    return valString
  }
}
