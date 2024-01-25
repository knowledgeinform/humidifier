// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2019 The Johns Hopkins University Applied Physics Laboratory LLC (JHU/APL).  All Rights Reserved.
//
// This material may be only be used, modified, or reproduced by or for the U.S. Government pursuant to the license
// rights granted under the clauses at DFARS 252.227-7013/7014 or FAR 52.227-14. For any other permission, please
// contact the Office of Technology Transfer at JHU/APL: Telephone: 443-778-2792, Internet: www.jhuapl.edu/ott
//
// NO WARRANTY, NO LIABILITY. THIS MATERIAL IS PROVIDED 'AS IS.' JHU/APL MAKES NO REPRESENTATION OR WARRANTY WITH
// RESPECT TO THE PERFORMANCE OF THE MATERIALS, INCLUDING THEIR SAFETY, EFFECTIVENESS, OR COMMERCIAL VIABILITY, AND
// DISCLAIMS ALL WARRANTIES IN THE MATERIAL, WHETHER EXPRESS OR IMPLIED, INCLUDING (BUT NOT LIMITED TO) ANY AND ALL
// IMPLIED WARRANTIES OF PERFORMANCE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT OF
// INTELLECTUAL PROPERTY OR OTHER THIRD PARTY RIGHTS. ANY USER OF THE MATERIAL ASSUMES THE ENTIRE RISK AND LIABILITY
// FOR USING THE MATERIAL. IN NO EVENT SHALL JHU/APL BE LIABLE TO ANY USER OF THE MATERIAL FOR ANY ACTUAL, INDIRECT,
// CONSEQUENTIAL, SPECIAL OR OTHER DAMAGES ARISING FROM THE USE OF, OR INABILITY TO USE, THE MATERIAL, INCLUDING,
// BUT NOT LIMITED TO, ANY DAMAGES FOR LOST PROFITS.
// //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const EventEmitter = require('events')
const superagent = require('superagent')
const ad = require('./abstract-driver.js')

class DeviceMFC extends EventEmitter {
    constructor({ id = 'A',
        testFlag,
        // setPoint,
        processVariable,
        debugTest,
        maxRefreshInterval = 1000,
        alicatType = 'MFC',
        address = 'localhost:3000',
    }) {
        super()
        this.oldGP = false
        this.id = id
        this.address = address
        this.alicatType = alicatType // default to mass-flow

        this.testFlag = testFlag
        if (testFlag === undefined) this.testFlag = false
        this.debugTest = debugTest
        if (debugTest === undefined) this.debugTest = false

        this.timeout = 200 // ms

        this.frameRepeat = new Map()

        this.property = new Map()
        this.property.set('unitID', new ad.DataPoint({ value: '' }))
        this.property.set('massFlow', new ad.DataPoint({ units: 'SLPM' }))
        this.property.set('volumeFlow', new ad.DataPoint({ units: 'LPM' }))
        this.property.set('gas', new ad.DataPoint({ value: '' }))
        this.property.set('pressure', new ad.DataPoint({ units: 'psia' }))
        this.property.set('temperature', new ad.DataPoint({ units: 'C' }))
        this.property.set('gasList', new Map())
        this.property.set('p', new ad.DataPoint({}))
        this.property.set('i', new ad.DataPoint({}))
        this.property.set('d', new ad.DataPoint({}))
        this.property.set('setPoint', new ad.DataPoint({}))
        this.property.set('status', new ad.DataPoint({ value: '' }))
        this.property.set('firmware', '')

        this.lockRefreshInterval = false
        this.maxRefreshInterval = maxRefreshInterval
        this.lastReadTime = {}
        this.lastReadTime.unitID = Date.now()
        this.lastReadTime.massFlow = Date.now()
        this.lastReadTime.volumeFlow = Date.now()
        this.lastReadTime.gas = Date.now()
        this.lastReadTime.pressure = Date.now()
        this.lastReadTime.temperature = Date.now()
        this.lastReadTime.gasList = Date.now()
        this.lastReadTime.p = Date.now()
        this.lastReadTime.i = Date.now()
        this.lastReadTime.d = Date.now()
        this.lastReadTime.setPoint = Date.now()
        this.lastReadTime.status = Date.now()
        this.lastReadTime.firmware = Date.now()

        // FS = full-scale
        this.FS = new Map()
        this.FS.set('massFlow', 0)
        this.FS.set('volumeFlow', 0)
        this.FS.set('pressure', 0)
        this.loopVar = 'massFlow'

        this.totalizer = false // assume no totalizer
        this.pressureController = false
        this.bidirectional = false // assume uni-directional

        this.processVariable = processVariable
        //   this.client = new Modbus()
        //   // open connection to a tcp line
        //   this.client.connectTCP(this.address)
        //   this.client.setID(this.id)
    }

    get gas() {
        superagent
        .get(this.address + '/api/MFCs/' + this.id + '/Gas Type')
        .then(res => {
            // console.log('Response')
            if (res.statusCode === 200) {
                // console.log(res.text)
                var mi = JSON.parse(res.text)
                // console.log(mi)
                this.property.get('gas').value = mi.value
                this.property.get('gas').time = Date.now()
            }
        })
        .catch(error => {
            if (this.testFlag) {
                this.property.get('gas').value = 'Air'
                this.property.get('gas').time = Date.now()
            } else {
                console.log('alicat-api error')
                console.error(error)
            }
            
        })
    return this.property.get('gas')
    }

    set gas(val) {
        console.log('NOT YET IMPLEMENTED!!')
    }

    get massFlow() {
        console.log('getting mass flow')
        superagent
            .get(this.address + '/api/MFCs/' + this.id + '/Mass Flow')
            .then(res => {
                // console.log('Response')
                if (res.statusCode === 200) {
                    // console.log(res.text)
                    var mi = JSON.parse(res.text)
                    // console.log(mi)
                    this.property.get('massFlow').value = mi.value.value
                    this.property.get('massFlow').time = mi.value.time
                    this.property.get('massFlow').units = mi.value.units
                    
                }
            })
            .catch(error => {
                if (this.testFlag) {
                    this.property.get('massFlow').value = -1
                    this.property.get('massFlow').units = 'SLPM'
                    this.property.get('massFlow').time = Date.now()
                } else {
                    console.log('alicat-api error')
                    console.error(error)
                }
            })
        return this.property.get('massFlow')
    }

    get pressure() {
        superagent
            .get(this.address + '/api/MFCs/' + this.id + '/Pressure')
            .then(res => {
                // console.log('Response')
                if (res.statusCode === 200) {
                    // console.log(res.text)
                    var mi = JSON.parse(res.text)
                    // console.log(mi)
                    this.property.get('pressure').value = mi.value.value
                    this.property.get('pressure').time = mi.value.time
                    this.property.get('pressure').units = mi.value.units
                    
                }
            })
            .catch(error => {
                if (this.testFlag) {
                    this.property.get('pressure').value = -1
                    this.property.get('pressure').units = 'psia'
                    this.property.get('pressure').time = Date.now()
                } else {
                    console.log('alicat-api error')
                    console.error(error)
                }
            })
        return this.property.get('pressure')
    }

    get temperature() {
        superagent
            .get(this.address + '/api/MFCs/' + this.id + '/Temperature')
            .then(res => {
                // console.log('Response')
                if (res.statusCode === 200) {
                    // console.log(res.text)
                    var mi = JSON.parse(res.text)
                    // console.log(mi)
                    this.property.get('temperature').value = mi.value.value
                    this.property.get('temperature').time = mi.value.time
                    this.property.get('temperature').units = mi.value.units
                    
                }
            })
            .catch(error => {
                if (this.testFlag) {
                    this.property.get('temperature').value = -1
                    this.property.get('temperature').units = 'C'
                    this.property.get('temperature').time = Date.now()
                } else {
                    console.log('alicat-api error')
                    console.error(error)
                }
            })
        return this.property.get('temperature')
    }

    get volumeFlow() {
        superagent
            .get(this.address + '/api/MFCs/' + this.id + '/Volumetric Flow')
            .then(res => {
                // console.log('Response')
                if (res.statusCode === 200) {
                    // console.log(res.text)
                    var mi = JSON.parse(res.text)
                    // console.log(mi)
                    this.property.get('volumeFlow').value = mi.value.value
                    this.property.get('volumeFlow').time = mi.value.time
                    this.property.get('volumeFlow').units = mi.value.units
                    
                }
            })
            .catch(error => {
                if (this.testFlag) {
                    this.property.get('volumeFlow').value = -1
                    this.property.get('volumeFlow').units = 'LPM'
                    this.property.get('volumeFlow').time = Date.now()
                } else {
                    console.log('alicat-api error')
                    console.error(error)
                }
            })
        return this.property.get('volumeFlow')
    }

    get setPoint() {
        superagent
            .get(this.address + '/api/MFCs/' + this.id + '/Set Point')
            .then(res => {
                // console.log('Response')
                if (res.statusCode === 200) {
                    // console.log(res.text)
                    var mi = JSON.parse(res.text)
                    // console.log(mi)
                    this.property.get('setPoint').value = mi.value.value
                    this.property.get('setPoint').time = mi.value.time
                    this.property.get('setPoint').units = mi.value.units
                    
                }
            })
            .catch(error => {
                if (this.testFlag) {
                    this.property.get('setPoint').value = -1
                    this.property.get('setPoint').units = 'SLPM'
                    this.property.get('setPoint').time = Date.now()
                } else {
                    console.log('alicat-api error')
                    console.error(error)
                }
            })
        return this.property.get('setPoint')
    }

    set setPoint(val) {
        superagent
            .post(this.address + '/api/MFCs/' + this.id + '/Set Point')
            .send(JSON.stringify(val))
            .then(res => {
                // console.log('Response')
                if (res.statusCode === 200) {
                    // console.log(res.text)
                    var mi = JSON.parse(res.text)
                    // console.log(mi)
                    this.property.get('setPoint').value = mi.value.value
                    this.property.get('setPoint').time = mi.value.time
                    this.property.get('setPoint').units = mi.value.units
                    
                }
            })
            .catch(error => {
                if (this.testFlag) {
                    this.property.get('setPoint').value = -1
                    this.property.get('setPoint').units = 'SLPM'
                    this.property.get('setPoint').time = Date.now()
                } else {
                    console.log('alicat-api error')
                    console.error(error)
                }
            })
    }

    initialize() {
        this.emit('initialized')
        return
    }

    commandString(shortDescription, args) {

    }
}

module.exports = {
    Device: DeviceMFC,
    commandString: DeviceMFC.commandString,
}

// var a = new DeviceMFC({ testFlag: false })

// setInterval(() => {
//     console.log(a.massFlow)
// }, 300)