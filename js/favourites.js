var API_URL = './api.php';
var apiKey = localStorage.getItem('apikey');
var navBar = document.getElementById('header');

document.addEventListener('DOMContentLoaded', function (){
    // If no API key, redirect to login
    if(!apiKey){
        alert('Please log in to view your favourites.');
        window.location.href = 'login.html';
        return;
    }
    fetchAndRenderFavourites();
});


//fetching users favs from api and rendering them
function fetchAndRenderFavourites(){
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function (){
        if (xhr.readyState != 4){
            return;
        }
        if (xhr.status >= 200 && xhr.status < 300){
            try{
                var resp = JSON.parse(xhr.responseText);
                if (resp.status === 'success'){
                    renderFavourites(resp.data);
                }
                else{
                    showError('Could not load favourites: ' + resp.data);
                }
            }
            catch (er){
                console.error('Parse error: ',er);
                showError('Unexpected error.');
            }
        }
        else{
            console.error('HTTP', xhr.status, xhr.responseText);
            showError('Failed to fetch favourites.');
        }
    };

    xhr.send(JSON.stringify({
        type: 'GetFavourites',
        apikey: apiKey
    }));
}

function renderFavourites(products){
    var container = document.querySelector('.favourites-container');
    container.innerHTML = '';

    if (!products || products.length === 0){
        container.innerHTML = '<p>No favourites yet.</p>';
        return;
    }

    for (var i = 0; i < products.length; i++){
		var p = products[i];
		var link = document.createElement('a');
		link.className = 'favourite-card';
		link.setAttribute('data-productid', p.ProductID);
		var displayPrice = (p.LowestPrice !== undefined && p.LowestPrice !== null) ? p.LowestPrice : p.price;

		link.innerHTML = '<span class="remove-fav" title="Remove"><i class="fa-solid fa-xmark"></i></span>' +
		'<img src="' + p.Image_url + '" alt="' + p.Title + '">' +
		'<div class="fav-desc">' +
		'<h5>' + p.Title + '</h5>' +
		'<h4>R' + (displayPrice ? displayPrice.toLocaleString() : ' ') + '</h4>' +
		'</div>' +
		'<span class="compare-fav" title="Compare"><i class="fa-solid fa-arrow-right-arrow-left"></i></span>';

		// Make the whole card clickable (except the remove/compare buttons)
        link.addEventListener('click', function(e){
            // Prevent navigation if clicking remove or compare
            if (e.target.closest('.remove-fav') || e.target.closest('.compare-fav')) return;
			var pid = this.getAttribute('data-productid');
			window.location.href = 'view.html?productID=' + pid;
        });


		container.appendChild(link);

		// Remove favourite handler
		(function(pid,cardEl){
			var btn = cardEl.querySelector('.remove-fav');
			btn.addEventListener('click', function (e){
				e.preventDefault();
				e.stopPropagation();
				removeFavourite(pid);
				cardEl.parentNode.removeChild(cardEl);
			});
		})(p.ProductID, link);

		// Compare handler 
		(function(product, cardEl){
			var cmpBtn = cardEl.querySelector('.compare-fav');
			if (!cmpBtn) return;
			cmpBtn.addEventListener('click', function(e){
				e.preventDefault();
				e.stopPropagation();
				localStorage.setItem('compareList', JSON.stringify([product.ProductID]));
				window.location.href = 'compare.html';
			});
		})(p, link);
	}

}

// Show error message in the favourites container
function showError(msg){
    var container = document.querySelector('.favourites-container');
    container.innerHTML = '<p class="error">' + msg + '</p>';
}

// Remove a product from favourites
function removeFavourite(productID){
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function (){
        if (xhr.readyState != 4){
            return;
        }
    };
    xhr.send(JSON.stringify({
        type: 'removeFavourite',
        apikey: apiKey,
        ProductID: productID
    }));
}

