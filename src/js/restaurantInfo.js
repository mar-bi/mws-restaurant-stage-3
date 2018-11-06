let restaurant;
var newMap;

/**
 * Initialize map as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  initRestaurantMap();
  addFormSubmitListener();
});

/**
 * Initialize leaflet map
 */
const initRestaurantMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      self.newMap = L.map('map', {
        center: [restaurant.latlng.lat, restaurant.latlng.lng],
        zoom: 16,
        scrollWheelZoom: false
      });
      L.tileLayer(
        'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}',
        {
          mapboxToken:
            'pk.eyJ1IjoibWFyLWJpIiwiYSI6ImNqanh5bzh3YTA3eTcza25kdHV0dzhqaGYifQ.kMbO0Bfw0zvLXQl_zevh9A',
          maxZoom: 18,
          attribution:
            'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
            '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
            'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
          id: 'mapbox.streets'
        }
      ).addTo(newMap);
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
    }
  });
};

/**
 * Get current restaurant from page URL.
 */
const fetchRestaurantFromURL = callback => {
  if (self.restaurant) {
    // restaurant already fetched!
    callback(null, self.restaurant);
    return;
  }
  const id = getParameterByName('id');
  if (!id) {
    // no id found in URL
    const error = 'No restaurant id in URL';
    callback(error, null);
  } else {
    Promise.all([
      DBHelper.fetchRestaurantById(id),
      DBHelper.fetchRestaurantReviews(id)
    ])
      .then(res => {
        const [restaurant, reviews] = res;
        // console.log('Restaurants', restaurant, reviews);
        restaurant.reviews = reviews;
        self.restaurant = restaurant;
        fillRestaurantHTML();
        callback(null, restaurant);
      })
      .catch(err => {
        console.error(err);
      });
  }
};

/**
 * Create restaurant HTML and add it to the webpage
 */
const fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.srcset = DBHelper.imageSrcsetWForRestaurant(restaurant);
  image.sizes = '(max-width: 699px) 270px, 400px';
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.alt = `A photo of ${restaurant.name}`;

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fillReviewsHTML();
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
const fillRestaurantHoursHTML = (
  operatingHours = self.restaurant.operating_hours
) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    if (operatingHours.hasOwnProperty(key)) {
      const row = document.createElement('tr');

      const day = document.createElement('td');
      day.innerHTML = key;
      day.className = 'restaurant-hours-cell';
      row.appendChild(day);

      const time = document.createElement('td');
      time.innerHTML = operatingHours[key];
      time.className = 'restaurant-hours-cell';
      row.appendChild(time);

      hours.appendChild(row);
    }
  }
};

/**
 * Create all reviews HTML and add them to the webpage.
 */
const fillReviewsHTML = (reviews = self.restaurant.reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  title.className = 'reviews-title';
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
};

/**
 * Create review HTML and add it to the webpage.
 */
const createReviewHTML = review => {
  const li = document.createElement('li');
  const name = document.createElement('p');
  li.className = 'reviews-item';
  name.className = 'reviews-text';
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = formatDate(review.updatedAt);
  date.className = 'reviews-text';
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  rating.className = 'reviews-text';
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  comments.className = 'reviews-text';
  li.appendChild(comments);

  return li;
};

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
const fillBreadcrumb = (restaurant = self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.className = 'breadcrumb-item';
  breadcrumb.appendChild(li);

  const link = document.createElement('a');
  link.innerHTML = restaurant.name;
  link.className = 'breadcrumb-link-current';
  link.href = window.location.href;
  link.setAttribute('aria-current', 'page');
  li.appendChild(link);
};

/**
 * Get a parameter by name from page URL.
 */
const getParameterByName = (name, url) => {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
};

/**
 * Register Service Worker
 */
const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log(
          `Registration is successful, the scope is ${registration.scope}`
        );
      })
      .catch(err => {
        console.log(err);
      });
  }
};

/**
 *  Format timestamp into human-readable date
 */
const formatDate = timestamp => {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  const date = new Date(timestamp);
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  return `${months[month]} ${day}, ${year}`;
};

/**
 * Submit a new restaurant review
 */
const submitNewReview = (event) => {
  event.preventDefault();
  const nameInput = document.querySelector('#form-name');
  const ratingInput = document.querySelector('#form-rating');
  const commentsInput = document.querySelector('#form-comments');
  const payload = {
    'restaurant_id': self.restaurant.id,
    'name': nameInput.value.trim(),
    'rating': Number(ratingInput.value),
    'comments': commentsInput.value.trim()
  };
  // console.log('PAYLOAD', payload);

  if(payload.name && payload.rating && payload.comments) {
    const url = 'http://localhost:1337/reviews/';
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload)
    }).then(res => res.json())
      .then(response => console.log('Success:', JSON.stringify(response)))
      .catch(error => console.error('Error:', error));
  }
};

/**
 * Listen for the review form submission
 */
const addFormSubmitListener = () => {
  const reviewForm = document.querySelector('#user-review-form');
  reviewForm.addEventListener('submit', submitNewReview);
};