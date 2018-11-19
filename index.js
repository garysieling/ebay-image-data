const _ = require('lodash');
const fs = require('fs');
const async = require('async');

function find(term, pageNumber) {
  const entriesPerPage = 100;
  const search = term.replace(/ /g, "%20");

  const url = `http://svcs.ebay.com/services/search/FindingService/v1?SECURITY-APPNAME=${process.env.EBAY_ID}&OPERATION-NAME=findItemsByKeywords&SERVICE-VERSION=1.0.0&RESPONSE-DATA-FORMAT=JSON&keywords=${search}&paginationInput.entriesPerPage=${entriesPerPage}&paginationInput.pageNumber=${pageNumber}&GLOBAL-ID=EBAY-US`;

  //console.log(url);
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? require('https') : require('http');
    const request = lib.get(url, (response) => {
      if (response.statusCode < 200 || response.statusCode > 299) {
         reject(new Error('Failed to load page, status code: ' + response.statusCode));
       }
      const body = [];
      response.on('data', (chunk) => body.push(chunk));
      response.on('end', () => resolve(JSON.parse(body.join(''))));
    });
    request.on('error', (err) => reject(err))
    })
}

const stopwords = [
  'new',
  'my',
  'lot',
  'collection',
  'hardware',
  'pro-grade'
];

const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

const named_entities = _.fromPairs([
    'Matte Black',
    'Oil Rubbed',
    'Door Knob',
    'Door Level',
    'Cabinet Knob',
    'Designers Impressions',
    'Kingston Design',
    'Satin Nickel',
    'Oil Rubbed Bronze',
    'Door Lever Knob',
    'Door Lock',
    'Door Knob'
  ].map(
    (item) => item.toLowerCase()
  ).map(
    (item) => tokenizer.tokenize(item)
  ).map(
    (item) => [item.join(' '), true]
  )
)

const synonyms = {}
synonyms['door lever knob'] = ['door knob', 'door lever']
synonyms['door knobs'] = ['door knob']

//console.log('named', named_entities);

function getEntities(title) {
  const tokens = tokenizer.tokenize(title || '').filter(
    (term) => !stopwords.includes(term.toLowerCase())
  ).map( (t) => t.toLowerCase() );

  let i = 0;
  let n2_gram = [];
  let n3_gram = [];
  let entities = [];
  let used = [];

  while (i < tokens.length) {
    const token = tokens[i];

    n3_gram.push(token);
    n2_gram.push(token);  

    if (n3_gram.length > 3) {
      n3_gram.shift();
    }
   
    if (n3_gram.length === 3) {
      let term = n3_gram.join(' ');
      if (!!named_entities[term]) {
        n3_gram.map( (t) => used.push(t) );

        if (!!synonyms[term]) {
           synonyms[term].map( (t) => entities.push(t) );
        } else {
           entities.push(term);
        }
      
        n3_grams = [];
        n2_grams = [];
      }
    }

    if (n2_gram.length > 2) {
      n2_gram.shift();
    }
    
    if (n2_gram.length === 2) {
      let term = n2_gram.join(' ');
      if (!!named_entities[term]) {
        n2_gram.map( (t) => used.push(t) );
        if (!!synonyms[term]) {
           synonyms[term].map( (t) => entities.push(t) );
        } else {
           entities.push(term);
        }

        n3_grams = [];
        n2_grams = [];
      }
    }

    i++;
  }

  //console.log('used', used)

  tokens.filter(
    (t) => !used.includes(t)
  ).map(
    (t) => entities.push(t)
  )

  return _.uniq(entities);
}

let i = 0;
let term_count = {};

function range(start, end) {
    return (new Array(end - start + 1)).fill(undefined).map((_, i) => i + start);
}

function all(allCb) {
  const data = async.map(
    range(1, 10),
    (i, cb) => {
      async.map(
        ["door knob", "faucet", "cabinet hardware", "drawer pulls", "shower heads"],
        (searchTerm, cb2) => {
          find(searchTerm, i).then(
            (data) => {
              cb2(null, data.findItemsByKeywordsResponse[0].searchResult[0].item)
            } 
          );
        },
        (e, allData) => {
          cb(null, _.flatten(allData));
        }
      );
    },
    (e, all) => {
      allCb( _.flatten(all) );
    });
}


all((records) => {
    const toIndex = records.map(
      (item) => {
        //console.log( JSON.stringify( item ));
        const record = {
           title: _.get(item, 'title[0]'), 
           entities: getEntities(_.get(item, 'title[0]')),
           category: _.get(item, 'primaryCategory[0].categoryName[0]', '').replace(/[ &]+/g, '_'), 
           image: _.get(item, 'galleryURL[0]'), 
           url: _.get(item, 'viewItemURL[0]')
        };

        record.entities.map(
          (e) => {
            term_count[e] = (term_count[e] || 0) + 1;
          }
        )

        return record;
      }
    );

    //console.log(toIndex);
    const directories = [];

    toIndex.map(
      ( { image, category } ) => {
        if (!!image && !!category) {
           const ebayId = image.split("/")[4];

           if (!fs.existsSync(`images/${category}`)) {
             fs.mkdirSync(`images/${category}`);
           }

           console.log(`curl --silent -o "images/${category}/${ebayId}" "${image}"`);
        }
      }
    )
    
    //console.log(term_count)
})
