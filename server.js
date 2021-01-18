const express = require('express');

// get credentials for http SSL certificate
var fs = require('fs');
var privateKey  = fs.readFileSync('/etc/letsencrypt/live/gamenite.app/privkey.pem', 'utf8');
var certificate = fs.readFileSync('/etc/letsencrypt/live/gamenite.app/fullchain.pem', 'utf8');
var credentials = {key: privateKey, cert: certificate};

// create express serverapp
const serverapp = express();
// create server
const server = require('https').createServer(credentials, serverapp);
// connect server to socket
const io = require('/home/ubuntu/gamenite-mvp/node_modules/socket.io')(server);
// get random roomId using uuid
// const { v4: uuidV4 } = require('uuid');
// keep track of players and player names
let playernames = [];
let playerscores = [];
let playernums = [];
let gamestate_global = 'setup';
// let numplayersselected_global = 0;
// let selectedplayercards_global = [];
let available_playernums = [5,4,3,2,1];
let peer2player = {};
let howmanycardschosen = 0;
let whichcardschosen = [];
// keep track of chosen center cards
let howmanycentercardschosen = 0;
// let whohaschosencentercards = [];
let whichcentercardschosen = [];
let peerlist = [];
let peers = [];
let streamids = {};
let current_activeplayer = 0;
const POINT_SCORE = 3;

function haspeer(cc, which_peer){
  for(i=0;i<cc.length;i++){
    if(cc[i]['peerid']===which_peer){
      return true;
    }
  }
  return false;
}

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}


serverapp.use(express.static('public'));

serverapp.get('/', (req, res) => {
  // server responds by redirecting root to /room
  res.redirect(`/dixet`);
});

serverapp.get('/:room', (req, res) => {
  // get roomid from URL
  // res.render('room', { roomId: req.params.room });
  res.json( { roomId: req.params.room } );
});

// when a client connects to server
io.on('connection', socket => {
  socket.on('join-room', (roomId, peeruserId, playerId) => {
    console.log(roomId, peeruserId);
    socket.join(roomId);
    // broadcast a user-connected event to all clients -> this will trigger event on client-side
    socket.to(roomId).broadcast.emit('user-connected', peeruserId);

    // add user as a new player
    peerlist.push({'peeruserId': peeruserId, 'peerswhochoseyourcard': [], 'playerId': playerId, 'scorechange': 0});
    peers.push(peeruserId);
    console.log(peerlist);
    streamids[peeruserId] = null;
    peer2player[peeruserId] = playerId;
    playernames.push(playerId);
    playerscores.push(0);
    thisplayernum = available_playernums.pop();
    playernums.push(thisplayernum);
    let playerinfo = {'playernames': playernames, 'playerscores': playerscores, 'playernums': playernums, 'playerids': peers, 'activeplayer': peerlist[current_activeplayer]['peeruserId'], 'status': 'connecting'};
    io.in(roomId).emit('update-player', playerinfo);

    // when user disconnects
    socket.on('disconnect', () => {
      socket.to(roomId).broadcast.emit('user-disconnected', peeruserId);
      player_removed = playernames.splice(playernames.indexOf(peer2player[peeruserId]), 1);
      playerscores.splice(playernames.indexOf(peer2player[peeruserId]), 1);
      pnum = playernums.splice(playernames.indexOf(peer2player[peeruserId]), 1);
      avchangestateailable_playernums.push(pnum);
//      let playerinfo = {'playernames': playernames, 'playerscores': playerscores, 'playernums': playernums, 'status': 'disconnecting'};
      io.in(roomId).emit('remove-player', {'playername': player_removed});
    });

    // when a new video stream comes in
    socket.on('addstreamid', (ids) => {
      streamids[ids['peerid']] = ids['streamid'];
      let streaminfo = {'playerids': peers, 'streamids':  streamids};
      io.in(roomId).emit('updatestreaminfo', streaminfo);
    });
//               this.socket.emit('changestate', 'playerchoosecard', {'playbuttonactive': false, 'infomsg': "Active player chooses card and gives clue. Then other players choose a card."});
    socket.on('changestate', (whatstate, options) => {
      if(whatstate == 'playerchoosecard'){
        io.in(roomId).emit('changestate_playgame', options);
        howmanycardschosen = 0;  // keep track of how many players have selected a card
        whichcardschosen = [];
        // reset center card chosen values
        for(i=0;i<peerlist.length;i++){
          peerlist[i]['peerswhochoseyourcard'] = [];
          peerlist[i]['scorechange'] = 0;
        }
      };
    });
    socket.on('cardselected', (peerid3, options) => {
      console.log('card selected by ', peerid3, ' which card ', options['whichcard']);
      if (haspeer(whichcardschosen, peerid3) === false){
        howmanycardschosen += 1;
      }
      // and keep track of who already chose (peerid is who chose)
      let peer_alreadychose = -1;
      for(i=0;i<whichcardschosen.length;i++){
        if(peerid3 === whichcardschosen[i]['peerid']){
          peer_alreadychose = i;
        }
      }
      // if peer already chose a card previously, just update which card they chose.
      if(peer_alreadychose===-1){
        whichcardschosen.push({'peerid': peerid3, 'whichcard': options['whichcard']});
      }
      else{
        whichcardschosen[peer_alreadychose]['whichcard'] = options['whichcard'];
      }
      // once everyone has chosen their card, go to next state - show cards in center
      if(howmanycardschosen >= playernames.length){
        // shuffle array before emitting
        whichcardschosen = shuffle(whichcardschosen);
        io.in(roomId).emit('changestate_showcentercards', {'whichcardschosen': whichcardschosen});
      }
    });
    // called when peer (peerid) selects a card - peerid2 => who selecte
    socket.on('centercardselected', (peerid2, options) => {
      console.log('active player: ', peerlist[current_activeplayer]['peeruserId']);
//      peerid = options['peerwhoselected'];
      if(peerid2 !== peerlist[current_activeplayer]['peeruserId']){
        // keep track of how many center cards were chosen, and who has chosen
        if(haspeer(whichcentercardschosen, peerid2)===false){
          howmanycentercardschosen += 1;
          console.log(peerid2, ' just chose a card: ', howmanycentercardschosen, ' cards chosen now.');
          // whohaschosencentercards.push(peerid2);
        };
        // and keep track of who chose what, and who owns the center cards (peerid is who chose)
        let peer_alreadychose = -1;
        for(i=0;i<whichcentercardschosen.length;i++){
          if(peerid2 === whichcentercardschosen[i]['peerid']){
            peer_alreadychose = i;
          }
        }
        // if peer already chose a card previously, just update which card they chose.
        if(peer_alreadychose === -1){
          whichcentercardschosen.push({'peerid': peerid2, 'owner': options['whichpeer']['owner'], 'idx': options['whichpeer']['idx']});
        } else {
          whichcentercardschosen[peer_alreadychose]['owner'] = options['whichpeer']['owner'];
          whichcentercardschosen[peer_alreadychose]['idx'] = options['whichpeer']['idx'];
        }

        console.log('centercardselected: ', whichcentercardschosen);
        if(howmanycentercardschosen >= playernames.length-1){
          for(j=0;j<whichcentercardschosen.length;j++){
            peerwhochose = whichcentercardschosen[j]['peerid'];
            peerchosen = whichcentercardschosen[j]['owner'];
            // key = who chose, value = which center card chose (peer owner)
            for(i=0;i<peerlist.length;i++){
              // you cannot choose your own card
              if(peerlist[i]['peeruserId'] === peerchosen && peerchosen !== peerwhochose){
                peerlist[i]['peerswhochoseyourcard'].push(peerwhochose);
              }
            }
          }
          console.log('FINAL CHOSEN CARDS, PEERS! ', peerlist);
          // now update scores for everyone
          for(i=0;i<peerlist.length;i++){
            peer = peerlist[i]['peeruserId']
            whochose = peerlist[i]['peerswhochoseyourcard'];
            howmanychoseyou = peerlist[i]['peerswhochoseyourcard'].length;
            // for the active player, he/she gets (POINT_SCORE) points if at least one but not all chose him/her.
            // each of the people who chose the active player gets (POINT_SCORE) points.
            if(peer === peerlist[current_activeplayer]['peeruserId']){
              if(howmanychoseyou>0 && howmanychoseyou<playernames.length-1){
                playerscores[playernames.indexOf(peer2player[peer])] += POINT_SCORE;
                peerlist[i]['scorechange'] += POINT_SCORE;
              }
              for(j=0;j<whochose.length;j++){
                playerscores[playernames.indexOf(peer2player[whochose[j]])] += POINT_SCORE;
                for(k=0;k<peerlist.length;k++){
                    if(peerlist[k]['peeruserId']===whochose[j]){
                      peerlist[k]['scorechange'] += POINT_SCORE;
                    }
                }
              }
            } else{
              // other players get (POINT_SCORE) points for each player that chosen their card
              playerscores[playernames.indexOf(peer2player[peer])] += POINT_SCORE*howmanychoseyou;
              peerlist[i]['scorechange'] += POINT_SCORE*howmanychoseyou;
            }
          }
          console.log('UPDATED SCORES: ',playerscores);
          // update active player
          old_activeplayer = current_activeplayer;
          current_activeplayer = current_activeplayer + 1
          if(current_activeplayer >= peerlist.length){
            current_activeplayer = 0;
          }
          // reset for next turn
          playerinfo = {'playernames': playernames, 'playerscores': playerscores, 'playernums': playernums, 'playerids': peers, 'activeplayer': peerlist[current_activeplayer]['peeruserId']};
          update_dict = {'playerinfo': playerinfo, 'peerlist': peerlist, 'oldactiveplayer': peerlist[old_activeplayer]['peeruserId']};
          console.log('update dict: ', update_dict);
          io.in(roomId).emit('changestate_updatescores', update_dict);
          howmanycardschosen = 0;
          whichcardschosen = [];
          howmanycentercardschosen = 0;
          // whohaschosencentercards = [];
          whichcentercardschosen = [];
        }
      };
    });
  });
});
// server listen on port 3000
server.listen(3000);
