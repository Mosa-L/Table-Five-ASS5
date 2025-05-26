document.addEventListener('DOMContentLoaded', function(){
    function getQueryParam(param){
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    const productId = getQueryParam('productID');
    if(!productId){
        alert('No product specified.');
        return;
    }

    //API key from localStorage (if user is logged in)
    // let apiKey = null;
    // const user = localStorage.getItem('apikey');
    // if(user){
    //     try{
    //         apiKey = JSON.parse(user).apikey;
    //     } catch (e) {}
    // }
	const apiKey = localStorage.getItem('apikey') || '3a160d66562032f9';

    // Fetch product info
    fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: "GetAllProducts",
            apikey: apiKey,
            search: { ProductID: productId },
            return: "*"
        })
    })
    .then(res => res.json())
    .then(res => {
        if(res.status !== "success" || !res.data.length){
            document.querySelector('#prodetails').innerHTML = "<p>Product not found.</p>";
            return;
        }
        const product = res.data[0];
        renderProduct(product);
    });

    function renderProduct(product) {
        //images
        const imgGroup = product.Image_url
            ? `<img class="big-img" src="${product.Image_url}" alt="${product.Title}" style="width:100%; max-width:400px;">` : '';
        //specs
        let specsHtml = '';
        if(product.Specifications){
            specsHtml = '<ul>';
            for(const [key, value] of Object.entries(product.Specifications)){
                specsHtml += `<li><b>${key}:</b> ${value}</li>`;
            }
            specsHtml += '</ul>';
        }
        // Render retailers
        let retailersHtml = '';
        if(product.Retailers && product.Retailers.length){
            retailersHtml = '<table style="width:100%; margin-bottom:20px;">';
            product.Retailers.forEach(r => {
                retailersHtml += `<tr>
                    <td>${r.Name}</td>
                    <td>R${r.Price}</td>
                    <td><a href="${r.Website_url}" target="_blank" class="buy-link">Buy</a></td>
                </tr>`;
            });
            retailersHtml += '</table>';
        }
        //reviews
        let reviewsHtml = '';
        if(product.Reviews && product.Reviews.length){
            reviewsHtml = product.Reviews.map(r =>
                `<div class="review">
                    <span class="review-stars">${'★'.repeat(r.Rating)}${'☆'.repeat(5 - r.Rating)}</span>
                    <span class="review-user">by ${r.Name || 'Anonymous'}</span>
                    <p>${r.Comment}</p>
                </div>`
            ).join('');
        }else{
            reviewsHtml = '<p>No reviews yet.</p>';
        }

        // populate page
        document.querySelector('#prodetails').innerHTML = `
            <div class="single-pro-image">${imgGroup}</div>
            <div class="single-pro-details">
                <h2>${product.Title}</h2>
                <h4>Product Details</h4>
                <p>${product.Description || ''}</p>
                <h4>Specifications</h4>
                ${specsHtml}
                <h4>Prices at Retailers</h4>
                ${retailersHtml}
                <h4>Reviews & Ratings</h4>
                <div class="reviews">${reviewsHtml}</div>
                <form class="review-form">
                    <label for="rating">Your Rating:</label>
                    <select id="rating" name="rating">
                        <option value="5">★★★★★</option>
                        <option value="4">★★★★☆</option>
                        <option value="3">★★★☆☆</option>
                        <option value="2">★★☆☆☆</option>
                        <option value="1">★☆☆☆☆</option>
                    </select>
                    <br>
                    <label for="comment">Your Review:</label>
                    <textarea id="comment" name="comment" rows="3" style="width:100%;"></textarea>
                    <br>
                    <button type="submit" class="review-submit">Submit Review</button>
                </form>
            </div>
        `;

        //review submission
        document.querySelector('.review-form').addEventListener('submit', function(e) {
            e.preventDefault();
            if(!apiKey){
                alert('You must be logged in to submit a review.');
                return;
            }
            const rating = document.getElementById('rating').value;
            const comment = document.getElementById('comment').value.trim();
            fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: "AddReview",
                    apikey: apiKey,
                    productID: product.ProductID,
                    rating: rating,
                    comment: comment
                })
            })
            .then(res => res.json())
            .then(res => {
                if (res.status === "success") {
                    alert('Review submitted!');
                    location.reload();
                } else {
                    alert('Error: ' + res.data);
                }
            });
        });
    }
});