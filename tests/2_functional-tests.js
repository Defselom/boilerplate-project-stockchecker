const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function () {
    this.timeout(5000);

    /*
     * 1. Visualiser un seul titre
     */
    test('Viewing one stock: GET request to /api/stock-prices', function (done) {
        chai
            .request(server)
            .get('/api/stock-prices')
            .query({ stock: 'GOOG' })
            .end(function (err, res) {
                assert.equal(res.status, 200);
                assert.property(res.body, 'stockData');
                assert.isObject(res.body.stockData);

                const { stock, price, likes } = res.body.stockData;
                assert.equal(stock, 'GOOG');
                assert.isNumber(price);
                assert.isAtLeast(price, 0);
                assert.isNumber(likes);

                googLikes = likes; // mémorise pour le test suivant
                done();
            });
    });

    /*
     * 2. Visualiser le même titre en ajoutant un like
     */
    test('Viewing one stock and liking it: GET request to /api/stock-prices', function (done) {
        chai
            .request(server)
            .get('/api/stock-prices')
            .query({ stock: 'GOOG', like: 'true' })
            .end(function (err, res) {
                assert.equal(res.status, 200);
                const { stockData } = res.body;
                assert.equal(stockData.stock, 'GOOG');
                assert.isAbove(stockData.likes, googLikes, 'likes should have incremented by 1');

                googLikes = stockData.likes; // nouvelle valeur de référence
                done();
            });
    });

    /*
     * 3. Reliker le même titre : le compteur ne doit PAS augmenter (même IP)
     */
    test('Viewing the same stock and liking it again: GET request to /api/stock-prices', function (done) {
        chai
            .request(server)
            .get('/api/stock-prices')
            .query({ stock: 'GOOG', like: 'true' })
            .end(function (err, res) {
                assert.equal(res.status, 200);
                const { stockData } = res.body;
                assert.equal(stockData.stock, 'GOOG');
                assert.equal(
                    stockData.likes,
                    googLikes,
                    'likes should not increase when liked again from same IP'
                );
                done();
            });
    });

    /*
     * 4. Visualiser deux titres sans like
     */
    test('Viewing two stocks: GET request to /api/stock-prices', function (done) {
        chai
            .request(server)
            .get('/api/stock-prices')
            .query({ stock: ['GOOG', 'MSFT'] })
            .end(function (err, res) {
                assert.equal(res.status, 200);
                assert.property(res.body, 'stockData');
                assert.isArray(res.body.stockData);
                assert.lengthOf(res.body.stockData, 2);

                const [googData, msftData] = res.body.stockData;
                assert.equal(googData.stock, 'GOOG');
                assert.equal(msftData.stock, 'MSFT');

                // rel_likes doivent être opposés
                assert.property(googData, 'rel_likes');
                assert.property(msftData, 'rel_likes');
                assert.equal(
                    googData.rel_likes,
                    -msftData.rel_likes,
                    'relative likes should be opposites'
                );

                initialRelLikes = googData.rel_likes; // on mémorise pour le test suivant
                done();
            });
    });

    /*
     * 5. Visualiser deux titres en les likant tous les deux
     */
    test('Viewing two stocks and liking them: GET request to /api/stock-prices', function (done) {
        chai
            .request(server)
            .get('/api/stock-prices')
            .query({ stock: ['GOOG', 'MSFT'], like: 'true' })
            .end(function (err, res) {
                assert.equal(res.status, 200);
                assert.property(res.body, 'stockData');
                assert.isArray(res.body.stockData);
                assert.lengthOf(res.body.stockData, 2);

                const [googData, msftData] = res.body.stockData;
                assert.equal(googData.stock, 'GOOG');
                assert.equal(msftData.stock, 'MSFT');
                assert.equal(
                    googData.rel_likes,
                    -msftData.rel_likes,
                    'relative likes should still be opposites'
                );

                // Les deux titres ont été likés ensemble depuis la même IP :
                // la différence de likes devrait rester la même qu’au test précédent
                assert.equal(
                    googData.rel_likes,
                    initialRelLikes,
                    'relative likes difference should not change when both stocks are liked simultaneously from the same IP'
                );
                done();
            });
    });
});
