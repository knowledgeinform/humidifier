const { Telnet } = require('telnet-client');

(async function () {
  const connection = new Telnet()

  // these parameters are just examples and most probably won't work for your use-case.
  const params = {
    host: '192.12.3.146',
    port: 23,
    negotiationMandatory: false,
    loginPrompt: 'HMT330 / 5.16',
    timeout: 1500,
    debug: true,
  }
//   console.log('connection',connection)

  try {
    await connection.connect(params)
    console.log('CONNECTED')
  } catch (error) {
    // handle the throw (timeout)
  }
  console.log('connection',connection)
  setInterval(async () => {
    try {
        var res = await connection.exec('send', {ors: '\r', irs: '\n', shellPrompt: '>', execTimeout: 2000})
        console.log('async result:', res)
    } catch (error) {
        console.log(error)
    }
  },2500)
  
})()