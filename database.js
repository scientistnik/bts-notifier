const fs = require('fs');

class Database {
  constructor() {
    this.users = JSON.parse(fs.readFileSync("./users.db")) || {}
    this.subs = JSON.parse(fs.readFileSync("./subs.db")) || {}
  }

  waitSub(id) {
    this.users[id] = this.users[id] || {}
    this.users[id].sub = Date.now()
    this.usersSave()
  }

  setLang(id, lang) {
    this.users[id] = this.users[id] || {}

    this.users[id].lang = lang
    this.usersSave()
  }

  getLang(id) {
    return this.users[id].lang
  }

  getSubs(id) {
    return Object.keys(this.subs).filter(acc => this.subs[acc].ids.includes(id))
  }
  
  getAllSubs() {
    return Object.keys(this.subs).filter(acc => this.subs[acc].ids.length > 0)
  }

  isWaitSub(id) {
    return this.users[id] && this.users[id].sub && Date.now() - this.users[id].sub < 60 * 60 * 1000
  }

  clearSub(id) {
    this.users[id].sub = 0
    this.usersSave()
  }

  addSubs(acc, id) {
    this.subs[acc] = this.subs[acc] || {ids: []}
    if (!this.subs[acc].ids.includes(id)) {
      this.subs[acc].ids.push(id)
      this.subsSave()
    }
  }

  removeSubs(acc, id) {
    this.subs[acc] = this.subs[acc] || {last: 0, ids: []}

    let index = this.subs[acc].ids.indexOf(id);
    if (index !== -1) 
      this.subs[acc].ids.splice(index, 1)

    this.subsSave()
  }

  usersSave() {
    fs.writeFileSync("./users.db",JSON.stringify(this.users))
  }

  subsSave() {
    fs.writeFileSync("./subs.db",JSON.stringify(this.subs))
  }
}

module.exports = new Database()
