var API_URL = './api.php';
var apiKey = localStorage.getItem('apikey') || '3a160d66562032f9'; //stored api key or default
var productContainer = document.querySelector('.proCont');  //container where products go
var navBar = document.getElementById('navbar');
var favouriteIDs = [];

//fetch user's favourites and check if they exist before adding 
function fetchFavouritesList(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        try {
            var resp = JSON.parse(xhr.responseText);
            if (resp.status === 'success') {
                favouriteIDs = resp.data.map(function(fav) { return fav.ProductID; });
                if (callback) callback();
            }
        } catch (e) {
            favouriteIDs = [];
            if (callback) callback();
        }
    };
    xhr.send(JSON.stringify({
        type: 'GetFavourites',
        apikey: apiKey
    }));
}

function fetchDistinct(field, populateFn) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', API_URL, true);
  xhr.setRequestHeader('Content-Type','application/json');
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    try {
      var res = JSON.parse(xhr.responseText);
      if (res.status === 'success') {
        populateFn(res.data);
      } else {
        console.error('Could not load ' + field + 's:', res.data);
      }
    } catch(e) {
      console.error(field + ' parse error:', xhr.responseText);
    }
  };
  xhr.send(JSON.stringify({
    type:   'GetDistinct',
    apikey: apiKey,
    field:  field
  }));
}

function populateBrandDropdown(brands) {
  var sel = document.getElementById('brand');
  sel.innerHTML = '<option value="">All Brands</option>';
  // brands is an array of strings
  brands.forEach(function(b) {
    var opt = document.createElement('option');
    opt.value       = b.toLowerCase();
    opt.textContent = b;
    sel.appendChild(opt);
  });
}

function populateRetailerDropdown(retailers) {
  var sel = document.getElementById('retailer');
  sel.innerHTML = '<option value="">All Retailers</option>';
  // retailers is an object {RetailerID: Name, …}
  Object.keys(retailers).forEach(function(id) {
    var name = retailers[id];
    var opt  = document.createElement('option');
    opt.value       = name.toLowerCase();
    opt.textContent = name;
    sel.appendChild(opt);
  });
}


function fetchCategories() {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', API_URL, true);
  xhr.setRequestHeader('Content-Type','application/json');
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    try {
      var res = JSON.parse(xhr.responseText);
      if (res.status === 'success') {
        populateCategoryDropdown(res.data);
      } else {
        console.error('Could not load categories:', res.data);
      }
    } catch(e) {
      console.error('Category parse error:', xhr.responseText);
    }
  };
  xhr.send(JSON.stringify({
    type:    'GetDistinct',
    apikey:  apiKey,
    field:   'Category'
  }));
}

function populateCategoryDropdown(categories) {
  var select = document.getElementById('category');
  
  select.innerHTML = '<option value="">All Categories</option>';
  for (var id in categories) {
    if (categories.hasOwnProperty(id)) {
      var opt = document.createElement('option');
      opt.value = categories[id].toLowerCase();
      opt.textContent = categories[id];
      select.appendChild(opt);
    }
  }
}

//Builds a “GetAllProducts” payload and send it, then retrieves the relevant products
function fetchAndRenderProducts(options){

    options = options || {};

    var payload = {
        type: 'GetAllProducts',
        apikey: apiKey,
        return: ['ProductID', 'Title', 'Brand', 'Image_url'],
        search: {},
        fuzzy: (typeof options.fuzzy ===  'boolean' ? options.fuzzy : true)
    };
    //search: adds this filter  to search when sending to api
    if (options.search && options.search.text){
        payload.search.Title = options.search.text;
    }
    //category: adds this filter  to search when sending to api
    if (options.category){
        payload.search.Category = options.category;
    }
    //price range: adds this filter  to search when sending to api
    if (typeof options.priceMin === 'number'){
        payload.search.price_min = options.priceMin;
    }
    if (typeof options.priceMax === 'number'){
        payload.search.price_max = options.priceMax;
    }
    //sorting: adds this when sending to the API
    if (options.sort){//sort on...
        payload.sort = options.sort;
    }
    if (options.order){ //ascending/descending
        payload.order = options.order;
    }

    //POST
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;

        var raw = xhr.responseText.trim(), resp;
        try {
            resp = JSON.parse(raw);
        } catch (e) {
            console.error('Non-JSON response:', raw);
            productContainer.innerHTML = '<p class="error">Server error loading products.</p>';
            return;
        }

        if (resp.status !== 'success') {
            console.error('API error:', resp.data);
            productContainer.innerHTML = '<p class="error">Error: ' + resp.data + '</p>';
            return;
        }

        //get all products
        var products = resp.data;

        //category post filter
        if (options.category) {
            products = products.filter(function(p) {
            return Array.isArray(p.Categories) &&
                    p.Categories.some(function(catName) {
                    return catName.toLowerCase() === options.category;
                    });
            });
        }
        //brand post filter
        if (options.brand) {
            products = products.filter(function(p){
                return p.Brand && p.Brand.toLowerCase() === options.brand;
            });
        }
        //retailer post-filter
        if (options.retailer) {
            products = products.filter(function(p){
                return Array.isArray(p.Retailers) &&
                p.Retailers.some(function(r){
                    return r.Name.toLowerCase() === options.retailer;
                });
            });
        }

        renderProducts(products);
        };


    xhr.send(JSON.stringify(payload));

    //Clear product container and append new cards
    function renderProducts(products){
        productContainer.innerHTML = '';
        for (var i = 0; i < products.length; i++){
            var p = products[i];
            var card = document.createElement('div');
            card.className = 'pro';

            //get the average rating for each product
            var avgRating = null;
            if (Array.isArray(p.Reviews) && p.Reviews.length > 0){ //only show if there are ratings
                var sum = p.Reviews.reduce(function(s,r){
                    return s + r.Rating;
                },0);
                avgRating = (sum/p.Reviews.length).toFixed(1);
            }

            card.innerHTML = 
            '<img src="' + p.Image_url + '" alt="' + p.Title + '">' +
            '<div class="description">' +
                '<h5>' + p.Title + '</h5>' +
                '<h4>From R' + (p.LowestPrice || '-') + '</h4>' +
                (avgRating ? '<p class="avg-rating" >' + avgRating + ' ★</p>': '') +
            '</div>' +
            //compare button
            '<a href="#" class="compare-btn" title="Add to compare">' +
                '<i class="fa-solid fa-arrow-right-arrow-left compare"></i>' +
            '</a>' +
            //favourites button
            '<a href="#" class="fav-btn" title="Add to favourites">' +
                '<i class="fa-regular fa-heart favourites"></i>' +
            '</a>';

            productContainer.appendChild(card);

			if(favouriteIDs.indexOf(p.ProductID) !== -1){
				var icon = card.querySelector('.fav-btn i');
				icon.classList.remove('fa-regular');
				icon.classList.add('fa-solid');
			}

            (function(product){
				card.querySelector('.compare-btn').addEventListener('click', function(e){
					e.stopPropagation();
					localStorage.setItem('compareList', JSON.stringify([product]));
					window.location.href = 'compare.html';
				});
			})(p);

            //go to view page
            (function(pid, el){
                el.addEventListener('click', function(){
                    window.location.href = 'view.html?productID=' + pid;
                });
            })(p.ProductID, card);


            (function(pid, favBtn, product) {
				favBtn.addEventListener('click', function(e) {
					e.preventDefault();
					e.stopPropagation();

					// Require login for favourites
					if(!apiKey || apiKey === '3a160d66562032f9'){
						alert('You must be logged in to add favourites.');
						window.location.href = 'login.html';
						return;
					}

					// Check if already in favourites
					if (favouriteIDs.indexOf(pid) !== -1) {
						alert('This product is already in your favourites!');
						return;
					}

					var xhr = new XMLHttpRequest();
					xhr.open('POST', API_URL, true);
					xhr.setRequestHeader('Content-Type','application/json');
					xhr.onreadystatechange = function() {
						if (xhr.readyState !== 4) return;
						try {
							var r = JSON.parse(xhr.responseText);
							if (r.status === 'success') {
								// Add to local list and update icon
								favouriteIDs.push(pid);
								var icon = favBtn.querySelector('i');
								icon.classList.remove('fa-regular');
								icon.classList.add('fa-solid');
							} else if (r.data && r.data.indexOf('already') !== -1) {
								alert('This product is already in your favourites!');
							} else {
								console.error('Fav API error:', r.data);
							}
						} 
						catch (err){
							console.error('Fav parse error:', xhr.responseText);
						}
					};
					xhr.send(JSON.stringify({
						type:      'Favourite',
						apikey:    apiKey,
						ProductID: pid
					}));
				});
			})(p.ProductID, card.querySelector('.fav-btn'), p);
        }
    }

}
//---------------------------FILTERS (actually showing/using them)---------------------------
document.addEventListener("DOMContentLoaded", function() {
    fetchCategories();
    fetchFavouritesList(function() {
        fetchAndRenderProducts();
    });
    fetchDistinct('Brand',    populateBrandDropdown);
    fetchDistinct('Retailer', populateRetailerDropdown);

    //search button
    document.getElementById('searchBut').addEventListener('click', function (){
        var text = document.getElementById('searchInput').value.trim();
        fetchAndRenderProducts({
            search: {
                text: text
            }
        });
    });
    //category dropdown
    document.getElementById('category').addEventListener('change', function(e){
        fetchAndRenderProducts({
            category: e.target.value
        });
    });
    //price range
    document.getElementById('price').addEventListener('change', function(e){
        var val = e.target.value;
        if (val === 'low'){
            fetchAndRenderProducts({
                sort: 'price',
                order: 'ASC'
            });
        }
        else if (val === 'high'){
            fetchAndRenderProducts({
                sort: 'price',
                order: 'DESC'
            });
        }
        else{
            fetchAndRenderProducts();
        }
    });
    document.getElementById('brand').addEventListener('change', function(e){
        fetchAndRenderProducts({ brand: e.target.value });
    });
    document.getElementById('retailer').addEventListener('change', function(e){
        fetchAndRenderProducts({ retailer: e.target.value });
    });

});