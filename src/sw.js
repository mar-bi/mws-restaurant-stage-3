self.importScripts('./js/idb.js');

/**
 * Running SW on localhost
 */
const APP_PREFIX = 'rest-rev-app';
const staticCacheVersion = 'v6';
const mapsCacheVersion = 'v6';
const imgCacheVersion = 'v6';
const staticCacheName = `${APP_PREFIX}-static-${staticCacheVersion}`;
const contentMapCache = `${APP_PREFIX}-maps-${mapsCacheVersion}`;
const contentImagesCache = `${APP_PREFIX}-imgs-${imgCacheVersion}`;
const allCaches = [staticCacheName, contentMapCache, contentImagesCache];

const REPO_PREFIX = '/';
const URLS = [
  REPO_PREFIX,
  `${REPO_PREFIX}restaurant.html`,
  `${REPO_PREFIX}js/main.js`,
  `${REPO_PREFIX}js/dbHelper.js`,
  `${REPO_PREFIX}js/restaurantInfo.js`,
  `${REPO_PREFIX}css/styles.css`,
  `${REPO_PREFIX}sass/styles.css`, //!!! REMOVE LATER
  `${REPO_PREFIX}manifest.json`,
  'https://unpkg.com/leaflet@1.3.1/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.3.1/dist/leaflet.js'
];

let DBPromise;

/**
 * Cache static assets(html, css, js)
 */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(staticCacheName).then(cache => {
      return cache.addAll(URLS);
    })
  );
});

/**
 * Delete old caches and create indexedDB
 */
self.addEventListener('activate', event => {
  event.waitUntil(
    (async function() {
      await cleanCache();
      await createAppDB();
    })()
  );
});

self.addEventListener('sync', event => {
  if (event.tag === 'send-review') {
    event.waitUntil(sendReviews());
  }
});

/**
 * Cache maps, images, and a JSON response from server
 */
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // cache map tiles and markers
  if (
    requestUrl.origin.startsWith('https://api.tiles.mapbox.com') ||
    requestUrl.pathname.startsWith('/leaflet@1.3.1/dist/images/')
  ) {
    event.respondWith(serveImgAssets(contentMapCache, event.request));
    return;
  }

  // cache images
  if (requestUrl.pathname.startsWith(`${REPO_PREFIX}images/`)) {
    event.respondWith(serveImgAssets(contentImagesCache, event.request));
    return;
  }

  // serve a restaurant page
  if (requestUrl.pathname === '/restaurant.html') {
    event.respondWith(
      caches.match('restaurant.html').then(response => {
        return response || fetch(event.request);
      })
    );
    return;
  }

  // serve restaurants data
  if (
    requestUrl.host === 'localhost:1337' &&
    requestUrl.pathname === '/restaurants'
  ) {
    event.respondWith(serveRestaurants(event.request, 'restaurants-data'));
    return;
  }

  // serve & add reviews
  if (
    requestUrl.host === 'localhost:1337' &&
    requestUrl.pathname.startsWith('/reviews')
  ) {
    if (event.request.method === 'GET') {
      const id = requestUrl.searchParams.get('restaurant_id');
      event.respondWith(serveReviews(event.request, 'reviews-data', id));
      return;
    }

    if (event.request.method === 'POST') {
      event.respondWith(addReview(event.request));
      return;
    }
  }

  // update favorite restaurants
  if (
    requestUrl.host === 'localhost:1337' &&
    requestUrl.pathname.startsWith('/restaurants') &&
    event.request.method === 'PUT'
  ) {
    event.respondWith(updateFavorite(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

function cleanCache() {
  return caches.keys().then(cacheNames => {
    return Promise.all(
      cacheNames
        .filter(cacheName => {
          return (
            cacheName.startsWith(APP_PREFIX) && !allCaches.includes(cacheName)
          );
        })
        .map(cacheName => caches.delete(cacheName))
    );
  });
}

function serveImgAssets(cacheName, eventRequest) {
  return caches.open(cacheName).then(cache => {
    return cache.match(eventRequest).then(response => {
      return (
        response ||
        fetch(eventRequest).then(response => {
          cache.put(eventRequest, response.clone());
          return response;
        })
      );
    });
  });
}

// -------- IndexedDB manipulation methods ----------------------

function createAppDB() {
  return (DBPromise = idb.open('mws-restaurants', 1, function(upgradeDB) {
    upgradeDB.createObjectStore('restaurants-data', { keyPath: 'id' });
    upgradeDB.createObjectStore('reviews-data');
    upgradeDB.createObjectStore('offline-reviews');
  }));
}

function writeAppDB(dataObj, objStore) {
  DBPromise.then(db => {
    const tx = db.transaction(objStore, 'readwrite');
    const store = tx.objectStore(objStore);
    if (objStore === 'reviews-data') {
      const key = dataObj[0].restaurant_id;
      store.put(dataObj, key);
    } else {
      dataObj.forEach(item => {
        store.put(item);
      });
    }
    return tx.complete;
  }).catch(err => console.log(err));
}

function readAllFromDB(objStore) {
  return DBPromise.then(db => {
    return db
      .transaction(objStore)
      .objectStore(objStore)
      .getAll();
  });
}

function readByIdFromDB(objStore, id) {
  return DBPromise.then(db => {
    return db
      .transaction(objStore)
      .objectStore(objStore)
      .get(id);
  });
}

function removeFromDb(objectStore, id) {
  return DBPromise.then(db => {
    const tx = db.transaction(objectStore, 'readwrite');
    tx.objectStore(objectStore).delete(id);
    return tx.complete;
  });
}

function updateRestaurant(restaurant) {
  DBPromise.then(db => {
    const tx = db.transaction('restaurants-data', 'readwrite');
    const store = tx.objectStore('restaurants-data');
    store.put(restaurant);
    return tx.complete;
  }).catch(err => console.log(err));
}

function updateReviews(review) {
  return DBPromise.then(async db => {
    const tx = db.transaction('reviews-data', 'readwrite');
    const reviewStore = tx.objectStore('reviews-data');
    const key = review.restaurant_id;
    const reviews = await reviewStore.get(key);
    const _reviews = [ ...reviews, review ];
    reviewStore.put(_reviews, key);
    return tx.complete;
  });
  //.catch(err => console.log(err));
}

function addOfflineReview(review) {
  return DBPromise.then(db => {
    const tx = db.transaction('offline-reviews', 'readwrite');
    const tempStore = tx.objectStore('offline-reviews');
    const id = review.id;
    tempStore.put(review, id);
    return tx.complete;
  });
  // .catch(err => console.log(err));
}

// -------------------Helper functions ------------------------

async function serveRestaurants(eventRequest, objectStore) {
  const dbData = await readAllFromDB(objectStore);
  const restaurants = dbData.length === 0 ? null : dbData;
  let fetchResponse;

  if (restaurants) {
    // console.log('restaurants from db', restaurants);
    return wrapIntoResponse(restaurants);
  }

  try {
    fetchResponse = await fetch(eventRequest);
    const jsonResponse = await fetchResponse.clone().json();
    writeAppDB(jsonResponse, objectStore);

    return fetchResponse;
  } catch (err) {
    console.error('Fetch error: ', err);
  }
}

async function serveReviews(eventRequest, objectStore, id) {
  const dbData = await readByIdFromDB(objectStore, id);
  const reviews = dbData && dbData.length === 0 ? null : dbData;
  let fetchResponse;

  if (reviews) {
    // console.log('restaurants from db', reviews);
    return wrapIntoResponse(reviews);
  }

  try {
    fetchResponse = await fetch(eventRequest);
    const jsonResponse = await fetchResponse.clone().json();
    writeAppDB(jsonResponse, objectStore);

    return fetchResponse;
  } catch (err) {
    console.error('Fetch error: ', err);
  }
}

async function updateFavorite(eventRequest) {
  try {
    const response = await fetch(eventRequest);
    const jsonResponse = await response.clone().json();
    updateRestaurant(jsonResponse);
    return response;
  } catch (err) {
    console.error('Fetch error: ', err);
  }
}

// async function addReview(eventRequest) {
//   const isOnline = navigator.onLine;
//   if (isOnline) {
//     try {
//       const response = await fetch(eventRequest);
//       const jsonResponse = await response.clone().json();
//       updateReviews(jsonResponse);
//       return response;
//     } catch (err) {
//       console.error('Fetch error: ', err);
//     }
//   } else {
//     // send message to clients
//     self.clients.matchAll().then(clients => {
//       clients.forEach(client =>
//         client.postMessage({
//           msg: 'You are offline now! All your reviews will be sent later.'
//         })
//       )
//     });
//     // save review to db
//     const review = await eventRequest.json();
//     updateReviews(review);
//     addOfflineReview(review);
//     return wrapIntoResponse(review);
//   }
// }

async function addReview(eventRequest) {
  const isOnline = navigator.onLine;
  try {
    const review = await eventRequest.json();
    await updateReviews(review);
    await addOfflineReview(review);

    if (!isOnline) {
      // send message to clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client =>
          client.postMessage({
            msg: 'You are offline now! All your reviews will be sent later.'
          })
        )
      });
    }
    self.registration.sync.register('send-review').then(() => {
      console.log('send-review sync is registered');
    });
    return wrapIntoResponse(review);
  } catch(error) {
    console.log('Error in adding review');
  }
}

async function sendReviews() {
  const dbData = await readAllFromDB('offline-reviews');

  if (dbData.length > 0) {
    const url = 'http://localhost:1337/reviews/';
    dbData.forEach(review => {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(review)
      })
      .then(response => removeFromDb('offline-reviews', review.id))
      .then(result => result)
      .catch(error => {
        console.error('Error in sendReview', error);
        return Promise.reject();
      });
    });
  }
  return Promise.resolve();
}

function wrapIntoResponse(dbObject) {
  const blob = new Blob([JSON.stringify(dbObject)], {
    type: 'application/json'
  });
  const init = { status: 200, statusText: 'Restaurants from DB' };
  return new Response(blob, init);
}
