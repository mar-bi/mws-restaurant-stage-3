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

/**
 * Cache maps, images, and a JSON response from server
 */
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  //cache map tiles and markers
  if (
    requestUrl.origin.startsWith('https://api.tiles.mapbox.com') ||
    requestUrl.pathname.startsWith('/leaflet@1.3.1/dist/images/')
  ) {
    event.respondWith(serveImgAssets(contentMapCache, event.request));
    return;
  }

  //cache images
  if (requestUrl.pathname.startsWith(`${REPO_PREFIX}images/`)) {
    event.respondWith(serveImgAssets(contentImagesCache, event.request));
    return;
  }

  //serve a restaurant page
  if (requestUrl.pathname === '/restaurant.html') {
    event.respondWith(
      caches.match('restaurant.html').then(response => {
        return response || fetch(eventRequest);
      })
    );
    return;
  }

  //serve JSON with restaurants data
  if (requestUrl.host === 'localhost:1337') {
    event.respondWith(serveJSON(event.request));
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

function createAppDB() {
  return (DBPromise = idb.open('mws-restaurants', 1, function(upgradeDB) {
    upgradeDB.createObjectStore('all-restaurants', { keyPath: 'id' });
  }));
}

function writeAppDB(dataObj) {
  DBPromise.then(db => {
    const tx = db.transaction('all-restaurants', 'readwrite');
    const store = tx.objectStore('all-restaurants');
    store.put({
      id: 1,
      data: dataObj
    });
    return tx.complete;
  }).catch(err => console.log(err));
}

function readAppDB() {
  return DBPromise.then(db => {
    return db
      .transaction('all-restaurants')
      .objectStore('all-restaurants')
      .getAll();
  });
}

async function serveJSON(eventRequest) {
  const dbData = await readAppDB();
  const restaurants = dbData.length === 0 ? null : dbData[0].data;
  let fetchResponse;

  if (restaurants) {
    console.log('restaurants from db', restaurants);
    return wrapIntoResponse(restaurants);
  }

  try {
    fetchResponse = await fetch(eventRequest);
    const jsonResponse = await fetchResponse.clone().json();
    writeAppDB(jsonResponse);

    return fetchResponse;
  } catch (err) {
    console.log('Fetch error: ', err);
  }
}

function wrapIntoResponse(dbObject) {
  const blob = new Blob([JSON.stringify(dbObject)], {
    type: 'application/json'
  });
  const init = { status: 200, statusText: 'Restaurants from DB' };
  return new Response(blob, init);
}
