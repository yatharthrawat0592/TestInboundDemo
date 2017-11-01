const express = require('express');
const app = express();
var fs = require('fs');
const {URL} = require('url');
var request = require('request-promise');

global.config = require('./passport-saml-config.json');
global.client = require('./client-config.json');

var buildUrl = require('build-url');

var bodyParser = require('body-parser');
var user;
// var redis = require("redis"), client = redis.createClient();
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.set('view engine', 'ejs');

//routes
app.get('/', function (req, res) {
    res.render('index.ejs', {
        idps: (global.config)
    });
});

const querystring = require('querystring');


app.get('/profile', function (req, res) {
    // req.queryParams;
    // dataJson = {
    //     client_id: '@!5C0B.B148.7E63.326C!0001!562E.F01E!0008!664D.7760.0EC3.762D',
    //     client_secret: 'ldapsu',
    //     code: req.query.code,
    //     redirect_uri: "http://localhost:3000/profile"
    // };
    var Outhclient = {
        clientId: global.client.clientId,
        clientSecret: global.client.clientSecret,
        accessTokenUri: 'https://' + global.client.host + '/oxauth/restv1/token',
        authorizationUri: 'https://' + global.client.host + '/oxauth/restv1/authorize',
        userInfoUri: 'https://' + global.client.host + '/oxauth/restv1/userinfo',
        redirectUri: 'http://localhost:3000/profile/',
        scopes: ['openid', 'profile', 'email', 'user_name']
    };
    getuserclaims(Outhclient, req.query.code).then(function (userdata) {
        this.user = userdata;
        return res.redirect('/profiledetail');

    }).catch(function (err) {
        console.log(err);
        return res.status(403).send(err);
    });


});
app.get('/profiledetail', function (req, res) {
    return res.render('profile.ejs', {
        user: (this.user)
    });
});

app.get('/login', function (req, res) {
    var prov = req.query.provider;
    providerJson = {
        provider: prov
    };
    var url = buildUrl('https://' + global.client.host, {
        path: 'oxauth/authorize',
        queryParams: {
            response_mode: 'query',
            response_type: ['code+id_token'],
            client_id: global.client.clientId,
            scope: ['openid+profile+email+user_name'],
            redirect_uri: ['http://localhost:3000/profile/'],
            state: new Buffer(JSON.stringify(providerJson)).toString('base64'),
            nonce: randomString(10),
            acr_values: 'passportsaml'
        }
    });
    //nonce=789927701&acr_values=passportsaml  eyJwcm92aWRlciI6ImlkcDEifQ==


    res.writeHead(302, {'Location': url});
    res.end();
});


var proxy = require('http-proxy').createProxyServer({
    host: proxy
    // port: 80
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});


var randomString = function (length) {
    var text = "";
    var possible = "0123456789";
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

var getuserclaims = function getUserClaims(Outhclient, code) {
    let authToken = new Buffer(Outhclient.clientId + ':' + Outhclient.clientSecret).toString('base64');
    let tokenRequestOptions = {
        method: 'POST',
        uri: Outhclient.accessTokenUri,
        headers: {
            Authorization: 'Basic ' + authToken,
            'content-type': 'application/x-www-form-urlencoded'
        },
        form: {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: Outhclient.redirectUri
        },
        resolveWithFullResponse: true
    };

    let tokenMetadata = {};
    return request(tokenRequestOptions)
        .then((response) => {
            if (!response) {
                return Promise.reject(false);
            }

            try {
                tokenMetadata = JSON.parse(response.body);
            } catch (exception) {
                console.log('--tokenMetadata--', exception.toString());
                return Promise.reject(false);
            }

            if (tokenMetadata.error) {
                return Promise.reject(false);
            }

            let userInfoOptions = {
                method: 'GET',
                uri: Outhclient.userInfoUri,
                headers: {
                    authorization: 'Bearer ' + tokenMetadata.access_token
                },
                resolveWithFullResponse: true
            };

            return request(userInfoOptions);
        })
        .then((response) => {
            if (!response) {
                return Promise.reject(false);
            }

            let userInfo = {};

            try {
                userInfo = JSON.parse(response.body);
            } catch (exception) {
                console.log('--userInfo--', exception.toString());
                return Promise.reject(false);
            }

            if (userInfo.error) {
                console.log('--userInfo--', userInfo.error_description);
                return Promise.reject(false);
            }

            return Promise.resolve(userInfo);
        })
        .catch((err) => {
            return Promise.reject(err);
        });
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";