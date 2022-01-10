const Exchange = require('../exchange')
const { sleep, getHms } = require('../helper')
const axios = require('axios')

class Binance extends Exchange {
  constructor(options) {
    super(options)

    this.id = 'BINANCE'
    this.lastSubscriptionId = 0
    this.subscriptions = {}

    this.endpoints = {
      PRODUCTS: 'https://api.binance.com/api/v1/ticker/allPrices',
    }

    this.options = Object.assign(
      {
        url: () => `wss://stream.binance.com:9443/ws`,
      },
      this.options
    )
  }

  formatProducts(data) {
    return data.map((product) => product.symbol.toLowerCase())
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

    this.subscriptions[pair] = ++this.lastSubscriptionId

    const params = [pair + '@trade']

    api.send(
      JSON.stringify({
        method: 'SUBSCRIBE',
        params,
        id: this.subscriptions[pair],
      })
    )

    // BINANCE: WebSocket connections have a limit of 5 incoming messages per second.
    await sleep(250)
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

    const params = [pair + '@trade']

    api.send(
      JSON.stringify({
        method: 'UNSUBSCRIBE',
        params,
        id: this.subscriptions[pair],
      })
    )

    delete this.subscriptions[pair]

    // BINANCE: WebSocket connections have a limit of 5 incoming messages per second.
    return new Promise((resolve) => setTimeout(resolve, 250))
  }

  onMessage(event, api) {
    const json = JSON.parse(event.data)

    if (json.E) {
      const pair = json.s.toLowerCase()

      return this.emitTrades(api.id, [
        {
          exchange: this.id,
          pair: pair,
          timestamp: json.E,
          price: +json.p,
          size: +json.q,
          side: json.m ? 'sell' : 'buy',
        },
      ])
    }
  }

  getMissingTrades(pair, startTime, endTime) {
    const endpoint = `https://api.binance.com/api/v3/aggTrades?symbol=${pair.toUpperCase()}&startTime=${
      startTime + 1
    }&endTime=${endTime}&limit=1000`

    return axios
      .get(endpoint)
      .then((response) => {
        console.info(
          `[${this.id}] recovered ${response.data.length} missing trades for ${pair} (${new Date(startTime).toISOString()} - ${new Date(
            endTime
          ).toISOString()})`
        )

        this.emitTrades(
          null,
          response.data.map((trade) => ({
            exchange: this.id,
            pair: pair,
            timestamp: trade.T,
            price: +trade.p,
            size: +trade.q,
            side: trade.m ? 'sell' : 'buy',
            count: trade.l - trade.f + 1,
          }))
        )
      })
      .catch((err) => {
        console.error(`Failed to get historical trades`, err)
      })
  }
}

module.exports = Binance
