import { Duplex, Writable } from 'streamx'
import { getClient } from '../../hyper/daemon'
import * as drives from '../../hyper/drives'
import { PermissionsError } from 'beaker-error-constants'

// globals
// =

var activeNamespaces = {} // map of {[origin]: Object}

// exported api
// =

export default {
  async info () {
    // TODO
  },

  async join (topic) {
    var drive = await getSenderDrive(this.sender)
    topic = massageTopic(topic, drive.discoveryKey)

    console.debug('Joining topic', topic)
    var stream = new Duplex()
    var topicHandle = getClient().peersockets.join(topic, {
      onmessage (peerId, message) {
        stream.write(['message', {peerId, message}])
      }
    })
    stream.on('data', data => {
      if (!Array.isArray(data) || !data[0] || !data[1]) {
        console.debug('Incorrectly formed message from peersockets send API', data)
        return
      }
      topicHandle.send(data[0], data[1])
    })
    stream.on('close', () => {
      console.debug('Closing topic', topic)
      topicHandle.close()
    })
    
    return stream
  },

  async watch () {
    var drive = await getSenderDrive(this.sender)
    var stream = new Writable()
    console.debug('Watching peers', drive.discoveryKey)
    var stopwatch = getClient().peers.watchPeers(drive.discoveryKey, {
      onjoin: (peer) => stream.write(['join', {peerId: peer.id}]),
      onleave: (peer) => stream.write(['leave', {peerId: peer.id}])
    })
    stream.on('close', () => {
      console.debug('Unwatching peers', drive.discoveryKey)
      stopwatch()
    })
    return stream
  }
}

// internal methods
// =

async function getSenderDrive (sender) {
  var url = sender.getURL()
  if (!url.startsWith('hyper://')) {
    throw new PermissionsError('PeerSockets are only available on hyper:// origins')
  }
  return drives.getOrLoadDrive(url)
}

function massageTopic (topic, discoveryKey) {
  return `webapp/${discoveryKey.toString('hex')}/${topic}`
}