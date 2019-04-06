# bts-notifier
Telegram bot for sending BitShares account notifications

## How to use
If you want to try how it works - [@btsnotifierbot](https://t.me/btsnotifierbot) (no guarantee of stable work)

## Your personal notifier
If you want to start your own bot, you need:
- Clone repo and install packages
```
$ git clone git@github.com:scientistnik/bts-notifier.git
$ cd bts-notifier
$ npm install
```
- Configurete bot in file `.env`: set `TELEGRAM_TOKEN` and if you want `TELEGRAM_ADMIN` (see `.env-template`)
- Start bot:
```
$ ./main.js
```
- if you want, start in docker:
```
$ docker build -t bts-notifier
$ docker run -b bts-notifier
```
## Contributing
Bug reports and pull requests are welcome on GitHub.

## License
The package is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).
