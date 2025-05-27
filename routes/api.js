'use strict';

module.exports = function (app) {

  const freeCodeAPIURL = (symbol) =>
    `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${symbol}/quote`;


  class StockData {
    static StockDataBD = [];

    constructor(stock, price, likes = 0, likedIps = []) {
      this.stock = stock;
      this.price = price;
      this.likes = likes;
      this.likedIps = likedIps;
    }

    save() {
      const idx = StockData.StockDataBD.findIndex(item => item.stock === this.stock);

      if (idx >= 0) {
        const existing = StockData.StockDataBD[idx];
        existing.price = this.price;
        return existing;
      }

      StockData.StockDataBD.push(this);
      return this;
    }

    static reset() {
      StockData.StockDataBD = []
    }

    addLike(ip) {
      const record = StockData.findStock(this.stock);

      // 1. le titre existe déjà
      if (record) {
        if (record.likedIps.includes(ip)) return record;   // like déjà compté
        record.likes++;
        record.likedIps.push(ip);
        return record;
      }

      // 2. nouveau titre
      this.likes = 1;
      this.likedIps = [ip];
      return this.save();
    }

    static findStock(symbol) {
      return StockData.StockDataBD.find(item => item.stock === symbol);
    }
  }


  /*  
  /api/stock-prices?stock=GOOG
  /api/stock-prices?stock=GOOG&like=true
  /api/stock-prices?stock=GOOG&stock=MSFT
  /api/stock-prices?stock=GOOG&stock=MSFT&like=true

  { stock: [ 'GOOG', 'MSFT' ], like: 'true' }
  {"stockData":[{"stock":"MSFT","price":62.30,"rel_likes":-1},{"stock":"GOOG","price":786.90,"rel_likes":1}]}
   */
  // Normalise l’adresse IP pour éviter les variantes ::ffff:127.0.0.1 / 127.0.0.1 / ::1
  const normalizeIp = (ip) => {
    if (!ip) return '';
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    if (ip === '::1') return '127.0.0.1';
    return ip;
  };

  app.route('/api/stock-prices')
    .get(async function (req, res) {
      try {
        const clientIpRaw =
          (req.headers['x-forwarded-for'] || '').split(',').shift().trim() || req.ip;
        const clientIp = normalizeIp(clientIpRaw);
        const { stock, like } = req.query
        // console.log(Array.isArray(stock));


        if (Array.isArray(stock) && stock.length == 2) {
          const [response1, response2] = await Promise.all([
            fetch(freeCodeAPIURL(stock[0])),
            fetch(freeCodeAPIURL(stock[1]))
          ]);

          const [data1, data2] = await Promise.all([
            response1.json(),
            response2.json()
          ]);

          const stockData1 = new StockData(data1.symbol, data1.close);
          const stockData2 = new StockData(data2.symbol, data2.close);

          let savedData1 = stockData1.save();
          let savedData2 = stockData2.save();
          if (like == "true") {
            const alreadyLikedOne =
              savedData1.likedIps.includes(clientIp) ||
              savedData2.likedIps.includes(clientIp);

            // On incrémente les deux titres **uniquement** si l’IP
            // ne les a jamais likés auparavant.
            if (!alreadyLikedOne) {
              savedData1 = savedData1.addLike(clientIp);
              savedData2 = savedData2.addLike(clientIp);
            }
          }
          console.log(savedData1, savedData2);


          return res.json(
            {
              "stockData": [
                {
                  "stock": savedData1.stock,
                  "price": savedData1.price,
                  "rel_likes": savedData1.likes - savedData2.likes
                },
                {
                  "stock": savedData2.stock,
                  "price": savedData2.price,
                  "rel_likes": savedData2.likes - savedData1.likes
                },
              ]
            }
          );
        }

        // case for one stock
        const response = await fetch(freeCodeAPIURL(stock));

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const { symbol, close: closePrice } = data;
        let newStockData = new StockData(symbol, closePrice);
        newStockData.save();
        if (like == "true") {
          newStockData = newStockData.addLike(clientIp);
        }
        //{"stockData":{"stock":"GOOG","price":786.90,"likes":1}}
        return res.json(
          {
            "stockData": newStockData
          }
        );
      } catch (error) {
        console.error('Error fetching data:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });
};
