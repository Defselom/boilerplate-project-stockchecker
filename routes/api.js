'use strict';

module.exports = function (app) {

  const freeCodeAPIURL = (symbol) =>
    `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${symbol}/quote`;


  class StockData {
    static StockDataBD = [];

    constructor(stock, price, likes = 0) {
      this.stock = stock;
      this.price = price;
      this.likes = likes;
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

    addLike() {
      const record = StockData.findStock(this.stock);

      if (record) {
        record.likes++;
        return record;
      }

      this.likes = 1;
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
  app.route('/api/stock-prices')
    .get(async function (req, res) {
      try {
        console.log(req.query);
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
            savedData1 = savedData1.addLike();
            savedData2 = savedData2.addLike();
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
          newStockData = newStockData.addLike();
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
