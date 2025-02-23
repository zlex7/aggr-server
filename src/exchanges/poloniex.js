const Exchange = require('../exchange')
const WebSocket = require('websocket').w3cwebsocket

class Poloniex extends Exchange {
  constructor() {
    super()

    this.id = 'POLONIEX'
    this.channels = {}

    this.endpoints = {
      PRODUCTS: 'https://api.poloniex.com/markets',
    }

    this.url = 'wss://ws.poloniex.com/ws/public'
  }

  formatProducts(data) {
    return data.map((product) => product.symbol)
  }

  /**
   * Sub
   * @param {WebSocket} api
   * @param {string} pair
   */
  async subscribe(api, pair) {
    if (!(await super.subscribe.apply(this, arguments))) {
      return
    }

    api.send(
      JSON.stringify({
        event: 'subscribe',
        channel: ['trades'],
        symbols: [pair],
      })
    )
  }

  /**
   * Sub
   * @param {WebSocket} api
   * @param {string} pair
   */
  async unsubscribe(api, pair) {
    if (!(await super.unsubscribe.apply(this, arguments))) {
      return
    }

    api.send(
      JSON.stringify({
        event: 'unsubscribe',
        channel: ['trades'],
        symbols: [pair],
      })
    )
  }

  formatTrade(trade) {
    return {
      exchange: this.id,
      pair: trade.symbol,
      timestamp: trade.createTime,
      price: +trade.price,
      size: trade.amount / trade.price,
      side: trade.takerSide,
    }
  }

  onMessage(event, api) {
    const json = JSON.parse(event.data)

    if (!json || !json.data) {
      return
    }

    return this.emitTrades(
      api.id,
      json.data.map((trade) => this.formatTrade(trade))
    )
  }

  onApiCreated(api) {
    this.startKeepAlive(api, { event: 'ping' }, 30000)
  }

  onApiRemoved(api) {
    this.stopKeepAlive(api)
  }
}

module.exports = Poloniex
