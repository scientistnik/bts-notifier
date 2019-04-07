#!/usr/bin/env node

const 
  BitShares = require('btsdex'),
  Telegraf = require('telegraf'),
  I18n = require('telegraf-i18n'),
  Markup = require('telegraf/markup'),
  db = require('./database.js'),
  fs = require('fs');

require('dotenv').config()

var bot, funcs = {}, i18n;

BitShares.node = process.env.BITSHARES_NODE
BitShares.subscribe('connected',start);

async function start() {
  // subscribe all accounts
  db.getAllSubs().forEach(acc => {
    funcs[acc] = getSubsFunc(acc)
    BitShares.subscribe('account',funcs[acc], acc);
  })

  bot = new Telegraf(process.env.TELEGRAM_TOKEN)

  i18n = new I18n({
    directory: `${__dirname}/locales`,
    defaultLanguage: 'en'
  })

  bot.use(i18n.middleware())

  bot.start(greeting)

  bot.command('help', helpCommand)
  bot.command('lang', langCommand)
  bot.command('add', addWaitAcc)
  bot.command('remove', removeWaitAcc)
  bot.command('show', showAcc)
  bot.command('settings', settings)

  bot.hears(I18n.match('menu.add_account'), addWaitAcc)
  bot.hears(I18n.match('menu.remove_account'), removeWaitAcc)
  bot.hears(I18n.match('menu.show_accounts'), showAcc)
  bot.hears(I18n.match('menu.settings'), settings)
  bot.action('cancel_wait_sub', cancelSub)
  bot.action(/remove_.*/, removeSub)
  bot.on('text', getText)

  bot.launch()
}

function helpCommand(ctx) {
  ctx.reply('/help - this text\n/lang <en> - set locale\n/add - add account\n/remove - remove account\n/show - show accounts\n/settings - show settings').catch(console.error)

}

function langCommand(ctx) {
  let id = ctx.chat.id,
    text = ctx.message.text;

  db.setLang(id, text.split(" ")[1]) 
}

async function restart() {
  BitShares.reconnect()
  db.getAllSubs().forEach(acc => {
    funcs[acc] = funcs[acc] || getSubsFunc(acc)
    BitShares.subscribe('account',funcs[acc], acc);
  })
}

function getSubsFunc(acc) {
  return async function() {
    let messages = {}

    for(index in db.subs[acc].ids) {
      let id = db.subs[acc].ids[index],
          lang = (db.users[id] && db.users[id].lang) || 'en';

      if (!messages[lang])
        messages[lang] = await parseOperations(acc, lang, arguments[0].map(history => history.op));
      
      if (messages[lang].length == 0)
        return

      bot.telegram.sendMessage(id, messages[lang], {parse_mode: 'markdown'}).catch(console.error)
    }
  }
}

async function parseOperations(acc, lang, ops) {
  let msg = ''

  for(i in ops) {
    let op = ops[ops.length - 1 - i];

    switch(op[0]) {
      case 0: // transfer
        let asset = await BitShares.assets.id(op[1].amount.asset_id),
            from = await BitShares.accounts.id(op[1].from),
            to = await BitShares.accounts.id(op[1].to),
            amount = op[1].amount.amount / 10 ** asset.precision;

        msg += `💸 *${i18n.t(lang,'ops.transfer')}*:\n 🙍‍♂️*${from.name}* ${i18n.t(lang,'ops.sent')} 🙍‍♂️*${to.name}* ${amount} ${asset.symbol}\n`;
        break;
      case 1:// limit order create
        let sell_param = await BitShares.assets.fromParam(op[1].amount_to_sell),
            r_param = await BitShares.assets.fromParam(op[1].min_to_receive),
            s_amount = sell_param.amount / 10 ** sell_param.asset.precision,
            r_amount = r_param.amount / 10 ** r_param.asset.precision;

        msg += `📋 *${i18n.t(lang,'ops.order_create')}*:\n ${i18n.t(lang,'ops.sell')} ${s_amount} ${sell_param.asset.symbol}, ${i18n.t(lang,'ops.receive')} ${r_amount} ${r_param.asset.symbol}\n`;
        break;
      case 4: // fill order
        let pay_param = await BitShares.assets.fromParam(op[1].pays),
            receive_param = await BitShares.assets.fromParam(op[1].receives),
            p_amount = pay_param.amount / 10 ** pay_param.asset.precision,
            re_amount = receive_param.amount / 10 ** receive_param.asset.precision;

        msg += `🔔 *${i18n.t(lang,'ops.fill_order')}*:\n ${i18n.t(lang,'ops.pays')} ${p_amount} ${pay_param.asset.symbol}, ${i18n.t(lang,'ops.receives')} ${re_amount} ${receive_param.asset.symbol}\n`;
        break;
      default: msg += `Some operation: ${JSON.stringify(op)}`
    }
  }
  return msg.length > 0 ? `‼️ 🙍‍♂️ *${acc}* ‼️\n\n${msg}` : ''
}

function greeting(ctx) {
  let buttons = [
    [ctx.i18n.t('menu.add_account'), ctx.i18n.t('menu.remove_account')],
    [ctx.i18n.t('menu.show_accounts'), ctx.i18n.t('menu.settings')]
  ]
  ctx.reply(ctx.i18n.t('greeting'), Markup.keyboard(buttons).extra()).catch(console.error)
  helpCommand(ctx)
}

function settings(ctx) {
  ctx.reply(ctx.i18n.t('settings')).catch(console.error)

}

function addWaitAcc(ctx) {
  db.waitSub(ctx.chat.id)
  let button = Markup.callbackButton(ctx.i18n.t('cancel'), 'cancel_wait_sub')
  ctx.reply(ctx.i18n.t('write_account'), Markup.inlineKeyboard([button]).extra()).catch(console.error)

}

function removeWaitAcc(ctx) {
  let accs = db.getSubs(ctx.chat.id),
      buttons = accs.map(acc => [Markup.callbackButton(`❌ ${acc}`, `remove_${acc}`)]);

  ctx.reply(accs.length > 0 ? ctx.i18n.t('delete_account') : ctx.i18n.t('not_accounts'), 
    Markup.inlineKeyboard(buttons).extra()).catch(console.error)

}

function removeSub(ctx) {
  let acc = ctx.update.callback_query.data.substring(7)
  db.removeSubs(acc, ctx.from.id)
  ctx.replyWithMarkdown(`*${acc}* ${ctx.i18n.t('removed')}`).catch(console.error)

}

function showAcc(ctx) {
  let accs = db.getSubs(ctx.chat.id)
  ctx.replyWithMarkdown(accs.length > 0 ? `${ctx.i18n.t('your_subs')}: *${accs}*` : ctx.i18n.t('empty_subs')).catch(console.error)

}

function cancelSub(ctx) {
  db.clearSub(ctx.from.id)
  ctx.reply(ctx.i18n.t('subs_canceled')).catch(console.error)

}

async function getText(ctx) {
  let id = ctx.chat.id,
      text = ctx.message.text;

  if (db.isWaitSub(id)) {
    try {
      await BitShares.accounts[text]
      db.addSubs(text, id)
      db.setLang(id, ctx.i18n.locale())
      db.clearSub(id)

      if (!funcs[text]) {
        funcs[text] = getSubsFunc(text)
        BitShares.subscribe('account',funcs[text], text);
      }

      ctx.replyWithMarkdown(`${ctx.i18n.t('added_sub')} *${text}*`).catch(console.error)

    } catch(e) {
      let button = Markup.callbackButton(ctx.i18n.t('cancel'), 'cancel_wait_sub')
      ctx.reply(`${e}`, Markup.inlineKeyboard([button]).extra()).catch(console.error)

    }
  } else {
    let msg = `${JSON.stringify(ctx.chat)} write:\n *${text}*`;
    console.log(msg)

    if (isSetAdmin())
      bot.telegram.sendMessage(process.env.TELEGRAM_ADMIN, msg,{parse_mode: 'markdown'}).catch(console.error)
    ctx.reply(ctx.i18n.t('no_meaning')).catch(console.error)

  }
}

function isSetAdmin() {
  return /^-?\d+$/.test(process.env.TELEGRAM_ADMIN)
}


process.on('unhandledRejection', (reason, p) => {
  let error = `Unhandled Rejection at: ${p} reason: ${reason}`
  console.log(error);
  if (isSetAdmin()) {
    bot.telegram.sendMessage(process.env.TELEGRAM_ADMIN, error).catch(console.error).finally(() => process.exit(1))
  }
  else {
    process.exit(1)
  }
});

