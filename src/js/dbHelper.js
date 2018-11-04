const SITE_PREFIX = '/';

/**
 * Common database helper functions.
 */
class DBHelper {
  /**
   * Database URL.
   */
  static get DATABASE_URL() {
    return 'http://localhost:1337/restaurants';
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback, url = DBHelper.DATABASE_URL) {
    fetch(url)
      .then(response => response.json())
      .then(respJson => callback(null, respJson))
      .catch(err => callback(err, null));
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        return callback(error, null);
      }
      const restaurant = restaurants.find(r => r.id == id);
      return restaurant
        ? callback(null, restaurant)
        : callback('Restaurant does not exist', null);
    }, DBHelper.DATABASE_URL);
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(
    cuisine,
    neighborhood,
    callback
  ) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants;
        if (cuisine != "all") {
          // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != "all") {
          // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map(
          (v, i) => restaurants[i].neighborhood
        );
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter(
          (v, i) => neighborhoods.indexOf(v) == i
        );
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter(
          (v, i) => cuisines.indexOf(v) == i
        );
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return `./restaurant.html?id=${restaurant.id}`;
  }

  /**
   * Get restaurant photo
   */
  static getRestaurantPhotograph(restaurant) {
    return restaurant.photograph || restaurant.id;
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    const filename = `${DBHelper.getRestaurantPhotograph(restaurant)}-270.jpg`;
    return `${SITE_PREFIX}images/${filename}`;
  }

  /**
   * Restaurant image srcset with x descriptors.
   */
  static imageSrcsetXForRestaurant(restaurant) {
    const path = `${SITE_PREFIX}images/${DBHelper.getRestaurantPhotograph(
      restaurant
    )}`;
    return `${path}-270.jpg 1x, ${path}-540.jpg 2x`;
  }

  /**
   * Restaurant image srcset with w descriptors.
   */
  static imageSrcsetWForRestaurant(restaurant) {
    const path = `${SITE_PREFIX}images/${DBHelper.getRestaurantPhotograph(
      restaurant
    )}`;
    return `${path}-270.jpg 270w, ${path}-400.jpg 400w, ${path}-540.jpg 540w, ${path}-800.jpg 800w`;
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker
    const marker = new L.marker(
      [restaurant.latlng.lat, restaurant.latlng.lng],
      {
        title: restaurant.name,
        alt: `${restaurant.name}, ${restaurant.neighborhood}`,
        url: DBHelper.urlForRestaurant(restaurant),
        keyboard: true
      }
    );
    marker.addTo(newMap);
    return marker;
  }
}
