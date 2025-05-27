<?php
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);
	include_once "config.php";

class Api{

	private $conn;

	private $data;

	public function __construct($dbConn){

		$this->conn=$dbConn;
		$this->parseRequestData();
	}

	private function parseRequestData(){

		$contentType=$_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';

		if(strpos($contentType,'application/json')!==false){

			$json=file_get_contents('php://input');
		
			$this->data=json_decode($json,true);
		
			if(json_last_error()!==JSON_ERROR_NONE){
		
				$this->respond("error","Invalid JSON format",400);
			}
		
		}else{
		
			$this->respond("error","application/json expected",415);
		}

	}

	private function respond($status, $message, $code){
		http_response_code($code);
		header('Content-Type: application/json');

		$jsonF=json_encode([
			'status'=>$status,
			'data'=>$message
		]);

		echo $jsonF;
		exit;
	}

	private function validateEmail($email){

		$regex="/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/";

		return preg_match($regex, $email)===1;
	}

	private function validatePassword($pass){

		$regex='/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{9,}$/';
		return preg_match($regex,$pass)===1;
	}

	private function validateName($name){

		if(empty($name)){

			return false;
		}

		return preg_match('/^[A-Za-z][A-Za-z\'\- ]{1,54}$/', $name) === 1;
	}

	private function userExists($email){

		$conn=$this->conn;

		$checkUser=$conn->prepare("SELECT * FROM users WHERE email=?");

		$checkUser->bind_param("s",$email);

		$checkUser->execute();
		$checkUser->store_result();

		$rows=$checkUser->num_rows;

		$checkUser->close();

		return $rows>0;
		
	}

	private function generateApiKey(){
		$bytes = random_bytes(32);
		
		$apiKey = bin2hex($bytes);
		
		$conn = $this->conn;
		$stmt = $conn->prepare("SELECT COUNT(*) FROM users WHERE Api_key = ?");
		$stmt->bind_param("s", $apiKey);
		$stmt->execute();
		$stmt->bind_result($count);
		$stmt->fetch();
		$stmt->close();
		
		if($count > 0){
			return $this->generateApiKey();
		}
		
		return $apiKey;
	}

	private function addUser($name,$surname,$email,$password,$user_type){

		$conn=$this->conn;

		$add=$conn->prepare("INSERT INTO users (Email,Password,FirstName,LastName,Type,Api_key) VALUES(?,?,?,?,?,?)");

		$apikey=$this->generateApiKey();

		$add->bind_param("ssssss",$email,$password,$name,$surname,$user_type,$apikey);

		if($add->execute()){

			$this->respond("success",['apikey'=>$apikey],201);
		}else{

			$this->respond("error",$add->error,500);
		}

		$add->close();
	}

	private function hashPassword($pass){

		$options=['memory_cost'=>1 << 15, 'time_cost'=>2, 'threads'=>1];

		$hash=password_hash($pass,PASSWORD_ARGON2ID,$options);

		return $hash;
	}

	private function checkApiKey($apikey){

		$conn=$this->conn;

		if(isset($apikey)){

			$stmt=$conn->prepare("SELECT email FROM users WHERE Api_key=?");

			$stmt->bind_param("s",$apikey);

			if($stmt->execute()){

				$result=$stmt->get_result();

				if($result->num_rows>0){
					return true;
				}else{

					return false;
				}

			}else{

				return false;
			}
		}

		return false;
	}

	private function getReturnAttr($fields){

		$validFields=['ProductID', 'Title', 'Brand', 'Description', 'Image_url'];

		if(!isset($fields)||empty($fields)){

			$this->respond("error","Return parameters not specified",400);
		}

		if($fields==="*"){

			$queryAttr="*";
		}else{

		$invalidFields = array_filter($fields, function($f) use ($validFields) {
			return !in_array($f, $validFields);
		});

		if (!empty($invalidFields)) {
			$this->respond("error","Invalid return parameter(s)", 400);
		}

		$final_fields=array_filter($fields, function($f) use ($validFields){
			return in_array($f,$validFields);
		});

		$queryAttr=!empty($final_fields)?implode(",", $final_fields):"*";

		}

		return $queryAttr;

	}

	private function handleFilter(){

		$data=$this->data;
		$conn=$this->conn;

		$query="SELECT DISTINCT p.* FROM products AS p";

		$values=[];
    	$types='';
		$joins='';
    	$where=[];
		$products=null;

		//Category filtering
		if(isset($data['category'])){

			$joins.=" JOIN product_categories pc ON p.ProductID=pc.ProductID ";
			$where[]="pc.CategoryID=?";
			$values[]=$data['category'];
			$types.='i';
		}

		//Retailer filtering
		if (isset($data['retailer'])) {
			$joins.=" JOIN product_retailers pr ON p.ProductID=pr.ProductID";
			$where[]="pr.RetailerID = ?";
			$values[]=$data['retailer'];
			$types.='i';
    	}

		//Brand filtering
		if (isset($data['brand'])) {
			$where[] = "p.Brand = ?";
			$values[] = $data['brand'];
			$types .= 's';
    	}	

		$query.=$joins;
		if(!empty($where)){
			$query.=" WHERE ".implode(" AND ", $where);
		}

		$productStmt=$conn->prepare($query);

		if(!empty($values)){

			$productStmt->bind_param($types,...$values);
		}

		if($productStmt->execute()){

			$result=$productStmt->get_result();
			$products=$result->fetch_all(MYSQLI_ASSOC);
		}else{

			$this->respond('error',$productStmt->error,500);
			$products=null;
		}

		//Adding prices and retailers
		foreach ($products as &$product) {
			$productID=$product['ProductID'];

			$stmt=$conn->prepare(
				"SELECT r.RetailerName, r.Website_url, pr.Price, pr.Stock
				FROM retailers AS r JOIN product_retailers as pr ON r.RetailerID=pr.RetailerID
				WHERE ProductID=?"
			);

			$stmt->bind_param("i", $productID);
			if(!$stmt->execute()){

				$this->respond("error", $stmt->error, 500);
			}
			$result=$stmt->get_result();

			$retailers=[];
			while($row=$result->fetch_assoc()){

				$retailers[] = [
					'Name' => $row['RetailerName'],
					'Website_url' => $row['Website_url'],
					'Price' => $row['Price'],
					'Stock' => $row['Stock']
				];
			}

			$product['Retailers']=$retailers;

			//Adding lowestPrice
			$product['LowestPrice']=$this->lowestPrice($product);
			$stmt->close();
		}
    	unset($product);

		//Filter by price
		if (isset($data['price_min'])){
			$term=$data['price_min'];
			$products = array_filter($products, function($p) use ($term) {
				return isset($p['LowestPrice']) && $p['LowestPrice']>=$term;
			});
		}
			
		if (isset($data['price_max'])){
			$term=$data['price_max'];
			$products = array_filter($products, function($p) use ($term) {
				return isset($p['LowestPrice']) && $p['LowestPrice']<=$term;
			});
		}

		//Adding reviews
		foreach ($products as &$product) {
			$productID=$product['ProductID'];

			$stmt=$conn->prepare(
				"SELECT u.FirstName, u.LastName, r.Rating, r.Comment, r.ReviewDate
				FROM users AS u JOIN reviews as r ON u.UserID=r.UserID
				WHERE ProductID=?"
			);

			$stmt->bind_param("i", $productID);
			if(!$stmt->execute()){

				$this->respond("error", $stmt->error, 500);
			}

			$result=$stmt->get_result();

			$reviews=[];
			while($row=$result->fetch_assoc()){

				$reviews[] = [
					'Name' => $row['FirstName'],
					'Surname' => $row['LastName'],
					'Rating' => $row['Rating'],
					'Comment' => $row['Comment'],
					'Date' => $row['ReviewDate']
				];
			}

			$product['Reviews']=$reviews;
			$stmt->close();
		}
    	unset($product);

		$this->respond('success',$products,200);

	}

	private function buildQuery($data){

		$conn=$this->conn;

		$validFields=['ProductID', 'Title', 'Brand', 'Description', 'Image_url'];

		$sortFields=['ProductID','Title','Brand'];
		$sortDir=['ASC','DESC'];
		$searchFields=['ProductID', 'Title', 'Brand'];

		if(!isset($data['return'])||empty($data['return'])){

			$this->respond("error","Return parameters not specified",400);
		}

		$attributes=$this->getReturnAttr($data['return']);

		if(stripos($attributes, 'ProductID') === false&&stripos($attributes,'*')===false) {
			$attributes .= ',ProductID';
		}

		$query="SELECT $attributes FROM products";
		$prepare=false;



		if(isset($data['search'])){

			$clauses=[];
			$values=[];
			$types='';

			$search = [];
			if (isset($data['search']) && is_array($data['search'])) {
				foreach ($data['search'] as $key => $value) {
					if ($key !== 'Category' && $key !== 'Specification') {
						$search[$key]=$value;
					}
				}
			}
			$fuzzy=isset($data['fuzzy'])?$data['fuzzy']:true;

			foreach($search as $attr=>$term){
				if (in_array($attr,$searchFields)){

					if ($attr=='ProductID') {
						$clauses[]="$attr = ?";
						$values[]=$term;
						$types.='i';

					} else {
						if ($fuzzy == true){
							$clauses[]="$attr LIKE ?";
							$values[]="%".$term."%";
						} else {
							$clauses[]="$attr= ?";
							$values[]=$term;
						}
			
						$types .= 's';
					}
					
				}else{

					$this->respond("error","Invalid Search Parameter",400);
				}
			}

			$whereSQL='';
			if(!empty($clauses)){
				$whereSQL=" WHERE " . implode(" AND ", $clauses);
				$prepare=true;
			}

			$query.=$whereSQL;

		}

		if(isset($data['sort'])&&in_array($data['sort'],$sortFields)){

				$sort=$data['sort'];
				$query.=" ORDER BY $sort";

				if(isset($data['order'])&&in_array($data['order'],$sortDir)){

					$order=$data['order'];
					$query.=" $order";
				}
		}

		if(isset($data['limit'])&&is_numeric($data['limit'])){

			$limit=(int) $data['limit'];

			$query.=" LIMIT $limit";
		}


		$productStmt=$conn->prepare($query);

		if($prepare){

			$productStmt->bind_param($types,...$values);
		}

		if($productStmt->execute()){

			$result=$productStmt->get_result();
			$products=$result->fetch_all(MYSQLI_ASSOC);
		}else{

			$this->respond('error',$productStmt->error,500);
			$products=null;
		}
		
		return $products;
	}

	private function handleGetAllProducts(){

		$data=$this->data;
		$conn=$this->conn;

		if(!isset($data['apikey'])){

			$this->respond("error","Apikey missing",400);
		}

		$auth=$this->checkApiKey($data['apikey']);

		if(!$auth){

			$this->respond('error','Access Unauthorized',401);
		}

		$products=$this->buildQuery($data);

		//Adding retailers and prices
		foreach ($products as &$product) {
			$productID=$product['ProductID'];

			$stmt=$conn->prepare(
				"SELECT r.RetailerName, r.Website_url, pr.Price, pr.Stock
				FROM retailers AS r JOIN product_retailers as pr ON r.RetailerID=pr.RetailerID
				WHERE ProductID=?"
			);

			$stmt->bind_param("i", $productID);
			if(!$stmt->execute()){

				$this->respond("error", $stmt->error, 500);
			}
			$result=$stmt->get_result();

			$retailers=[];
			while($row=$result->fetch_assoc()){

				$retailers[] = [
					'Name' => $row['RetailerName'],
					'Website_url' => $row['Website_url'],
					'Price' => $row['Price'],
					'Stock' => $row['Stock']
				];
			}

			$product['Retailers']=$retailers;
			$stmt->close();
		}
    	unset($product);

		//Adding categories [array]
		foreach ($products as &$product) {
			$productID = $product['ProductID'];

			$stmt=$conn->prepare(
				"SELECT c.Name 
				FROM product_categories pc
				JOIN categories c ON pc.CategoryID = c.CategoryID
				WHERE pc.ProductID = ?"
			);

			$stmt->bind_param("i", $productID);
			if(!$stmt->execute()){

				$this->respond("error", $stmt->error, 500);
			}
			$result=$stmt->get_result();

			$categories=[];
			while($row=$result->fetch_assoc()){

				$categories[]=$row['Name'];
			}

			$product['Categories']=$categories;
			$stmt->close();
		}
    	unset($product);

		//Adding specs [assoc_array]
		foreach ($products as &$product) {
			$productID=$product['ProductID'];

			$stmt=$conn->prepare(
				"SELECT SpecType, SpecValue
				FROM specifications
				WHERE ProductID=?"
			);

			$stmt->bind_param("i", $productID);

			if(!$stmt->execute()){

				$this->respond("error", $stmt->error, 500);
			}
			
			$result=$stmt->get_result();

			$specs=[];
			while($row=$result->fetch_assoc()){

				$specs[$row['SpecType']]=$row['SpecValue'];
			}

			$product['Specifications']=$specs;
			$stmt->close();
		}
    	unset($product);

		//Adding reviews
		foreach ($products as &$product) {
			$productID=$product['ProductID'];

			$stmt=$conn->prepare(
				"SELECT u.FirstName, u.LastName, r.Rating, r.Comment, r.ReviewDate
				FROM users AS u JOIN reviews as r ON u.UserID=r.UserID
				WHERE ProductID=?"
			);

			$stmt->bind_param("i", $productID);
			if(!$stmt->execute()){

				$this->respond("error", $stmt->error, 500);
			}

			$result=$stmt->get_result();

			$reviews=[];
			while($row=$result->fetch_assoc()){

				$reviews[] = [
					'Name' => $row['FirstName'],
					'Surname' => $row['LastName'],
					'Rating' => $row['Rating'],
					'Comment' => $row['Comment'],
					'Date' => $row['ReviewDate']
				];
			}

			$product['Reviews']=$reviews;
			$stmt->close();
			//Adding lowest price
			$product['LowestPrice']=$this->lowestPrice($product);
		}
    	unset($product);

		if(isset($data['search'])){

			$search=$data['search'];

			//Search for price max & min
			foreach($search as $attr=>$term){

					if ($attr=='price_min'){
						$products = array_filter($products, function($p) use ($term) {
							return isset($p['LowestPrice']) && $p['LowestPrice']>=$term;
						});

					} else if ($attr=='price_max'){
						$products = array_filter($products, function($p) use ($term) {
							return isset($p['LowestPrice']) && $p['LowestPrice']<=$term;
						});
					}
			}

		}

		//Sort for prices
		if(isset($data['sort'])&&($data['sort']=='price')){

			if(isset($data['order'])){

				$products=$this->sortProducts($products,'LowestPrice',$data['order']);

			}else{

				$products=$this->sortProducts($products,'LowestPrice');
			}	
		}

		//Remove ProductID if necessary
		$returnAttr=$this->getReturnAttr($data['return']);

		if (stripos($returnAttr,'ProductID')===false && $returnAttr!=='*'){
			foreach ($products as &$p) {
				unset($p['ProductID']);
			}
			unset($p);
		}

		$this->respond('success',$products,200);

	}

	private function handleRegister(){

		$data=$this->data;

		$email=null;
		$name=null;
		$surname=null;
		$password=null;
		$user_type=null;

		if(!isset($data['user_type'])||($data['user_type']!='Customer'&&$data['user_type']!='Manager')){

			$this->respond("error","Invalid or missing user type",400);
		}

		$user_type=$data['user_type'];

		if(!isset($data['name'])||!$this->validateName($data['name'])){

			$this->respond("error","Invalid or missing name",400);
		}

		$name=$data['name'];

		if(!isset($data['surname'])||!$this->validateName($data['surname'])){

			$this->respond("error","Invalid or missing surname",400);
		}

		$surname=$data['surname'];

		if(!isset($data['email'])||!$this->validateEmail($data['email'])){

			$this->respond("error","Invalid or missing email",400);
		}

		if($this->userExists($data['email'])){

			$this->respond("error","User already exists",409);
		}

		$email=$data['email'];

		if(!isset($data['password'])||!$this->validatePassword($data['password'])){

			$this->respond("error","Password format insufficient, unsafe.",400);
		}

		$password=$this->hashPassword($data['password']);

		if(isset($name)&&isset($email)&&isset($password)&&isset($user_type)){

			$this->addUser($name,$surname,$email,$password,$user_type);
		}

	}

	private function handleFavourites(){//this function will add the users fav
		
		$data=$this->data;
		$conn=$this->conn;
	//probably need a an api key request 
		if(!isset($data['apikey'])||!$this->checkApiKey($data['apikey'])){	
			$this->respond('error',"Apikey missing or invalid",401);
		}	

		if(!isset($data['ProductID'])){
			//we need the productID to add the correct product to the favourites table the apikey is not sufficent 
			$this->respond('error',"productID missing",401);
		}

		$productID = $data['ProductID'];
		$userID ;
		$apikey = $data['apikey'];


		$stmt = $conn->prepare("SELECT UserID FROM users WHERE Api_key = ?");
		$stmt->bind_param("s", $apikey);
		$stmt->execute();
		$result = $stmt->get_result();

		if($result && $row = $result->fetch_assoc()){
			$userID = $row['UserID'];
		}else{

			$this->respond('error',"User not found",403);
		}
		//now that user is found we can use the userID to add to the favourites table 
		//but product id ?
		$stmt = $conn->prepare("INSERT INTO favourites (UserID, ProductId, Date_Added) VALUES (?, ?, NOW())");
		$stmt->bind_param("ii", $userID, $productID);

		if ($stmt->execute()) {
			$this->respond('success',"Favourite added successfully",201);
		} else {

			$this->respond('error',"Failed to add favourite",500);
		}

	}
	private function handleFavouriteProducts(){
		//will return an array of productids and then they can be used in the product table to return the persons favourite
		//the apikey should be sufficient in this case 
		$data = $this->data;//added this to make work 
		$conn = $this->conn; 
		if(!isset($data['apikey'])|| !$this->checkApiKey($data['apikey'])){
			
			$this->respond('error',"Missing or Invalid apikey",403);
		}

		$stmt = $conn->prepare("SELECT UserID FROM users WHERE Api_key = ?");
		$stmt->bind_param("s", $data['apikey']);
		$stmt->execute();
		$result = $stmt->get_result();

		if($result && $row = $result->fetch_assoc()){
			$userID = $row['UserID'];
		}else{
			
			$this->respond('error',"User not found",403);
		}


		$stmt = $conn->prepare("
			SELECT p.* ,t.price
			FROM favourites f 
			JOIN products p ON p.ProductID = f.ProductID 
			JOIN product_retailers  t ON t.ProductID = f.ProductID
			WHERE f.UserID = ?
			GROUP BY p.ProductID
		");
		$stmt->bind_param("i", $userID);
		$stmt->execute();
		$result = $stmt->get_result();

		$favouriteProducts = [];
		while ($row = $result->fetch_assoc()) {
			$favouriteProducts[] = $row;
		}

		$stmt->close();

		foreach ($favouriteProducts as &$product) {
			$productID=$product['ProductID'];

			$stmt=$conn->prepare(
				"SELECT r.RetailerName, r.Website_url, pr.Price, pr.Stock
				FROM retailers AS r JOIN product_retailers as pr ON r.RetailerID=pr.RetailerID
				WHERE ProductID=?"
			);

			$stmt->bind_param("i", $productID);
			if(!$stmt->execute()){

				$this->respond("error", $stmt->error, 500);
			}
			$result=$stmt->get_result();

			$retailers=[];
			while($row=$result->fetch_assoc()){

				$retailers[] = [
					'Name' => $row['RetailerName'],
					'Website_url' => $row['Website_url'],
					'Price' => $row['Price'],
					'Stock' => $row['Stock']
				];
			}

			$product['Retailers']=$retailers;

			$lowestPrice=$this->lowestPrice($product);

			if(isset($lowestPrice)){

				$product['LowestPrice']=$lowestPrice;
			}

			$stmt->close();
		}
    	unset($product);

		$this->respond('success',$favouriteProducts,200);
		
	}

	private function handleRemoveFavourite(){
		//removes a single item from the favourites table 
		//will prob need the productID and apikey 
		$conn = $this->conn;
		$data = $this->data;

		if(!isset($data['apikey'])||!$this->checkApiKey($data['apikey'])){
			$this->respond('error',"Missing or Invalid apikey",403);
		}
		if(!isset($data['ProductID'])){
    	$this->respond('error', "Missing ProductID", 400);
		}
		$stmt = $conn->prepare("SELECT UserID FROM users WHERE Api_key = ?");
		$stmt->bind_param("s", $data['apikey']);
		$stmt->execute();
		$result = $stmt->get_result();

		if($result && $row = $result->fetch_assoc()){
			$userID = $row['UserID'];
		}else{
			
			$this->respond('error',"User not found",403);
		}

		//now that you have userID how to go about deletion ?
		$stmt = $conn->prepare("DELETE FROM favourites WHERE UserID = ? AND ProductID = ?");
		$stmt->bind_param("ii", $userID,$data['ProductID']);
		$stmt->execute();

		if($stmt->affected_rows > 0){
    	$this->respond('success', "Product removed from favourites", 200);
		}else{
    	$this->respond('error', "Product not found in favourites", 404);
		}
	}

	private function handleAddProduct() {
		$conn = $this->conn;
		$data = $this->data;
		 //the rest of the fields are for the product_retailor table

		 //add to specfifcations table
		$accepted =['Title','apikey','Description','Image_url','Brand','RetailerID','Price','Stock'];

		$requiredFields = ['apikey', 'Title', 'Description', 'Image_url', 'Brand', 'retailers', 'categories'];
		foreach ($requiredFields as $field) {
			if (!isset($data[$field])) {
				$this->respond("error", "$field missing", 400);
			}
		}

		if (!is_array($data['retailers']) || count($data['retailers']) === 0) {
			$this->respond("error", "Retailers must be a non-empty array", 400);
		}
		if (!is_array($data['categories']) || count($data['categories']) === 0) {
			$this->respond("error", "Categories must be a non-empty array", 400);
		}

		if (!$this->checkApiKey($data['apikey'])) {
			$this->respond('error', 'Invalid or missing apikey', 403);
		}

		$stmt = $conn->prepare("SELECT Type FROM users WHERE Api_key = ?");
		$stmt->bind_param("s", $data['apikey']);
		$stmt->execute();
		$result = $stmt->get_result();
		if ($result && $row = $result->fetch_assoc()) {
			if ($row['Type'] === "Customer") {
				$this->respond('error', 'Customer cannot perform this action', 403);
			}
		} else {
			$this->respond('error', "User not found", 403);
		}

		$stmt = $conn->prepare("INSERT INTO products (Title, Description, Image_url, Brand) VALUES (?, ?, ?, ?)");
		$stmt->bind_param("ssss", $data['Title'], $data['Description'], $data['Image_url'], $data['Brand']);
		if (!$stmt->execute()) {
			$this->respond('error', 'Failed to add product to products table', 500);
		}
		$productID = $conn->insert_id; 


		// Add categories
		foreach ($data['categories'] as $categoryName) {
			$stmt = $conn->prepare("SELECT CategoryID FROM categories WHERE Name = ?");
			$stmt->bind_param("s", $categoryName);
			$stmt->execute();
			$result = $stmt->get_result();
			if (!$result || $result->num_rows === 0) {
				$this->respond('error', "Category '$categoryName' not found", 400);
			}
			$row = $result->fetch_assoc();
			$categoryID = $row['CategoryID'];

			// Insert into product_categories if not already present
			$stmt = $conn->prepare("SELECT * FROM product_categories WHERE ProductID = ? AND CategoryID = ?");
			$stmt->bind_param("ii", $productID, $categoryID);
			$stmt->execute();
			$result = $stmt->get_result();
			if ($result->num_rows === 0) {
				$stmt = $conn->prepare("INSERT INTO product_categories (ProductID, CategoryID) VALUES (?, ?)");
				$stmt->bind_param("ii", $productID, $categoryID);
				if (!$stmt->execute()) {
					$this->respond('error', "Failed to add category '$categoryName'", 500);
				}
			}
		}

		// Handle retailers
		foreach ($data['retailers'] as $retailer) {
			if (!isset($retailer['RetailerName']) || !isset($retailer['Price']) || !isset($retailer['Stock'])) {
				$this->respond('error', 'Each retailer must include RetailerName, Price, and Stock', 400);
			}

			$retailerName = $retailer['RetailerName'];

			// Get RetailerID
			$stmt = $conn->prepare("SELECT RetailerID FROM retailers WHERE RetailerName = ?");
			$stmt->bind_param("s", $retailerName);
			$stmt->execute();
			$result = $stmt->get_result();
			if (!$result || $result->num_rows === 0) {
				$this->respond('error', "Retailer '$retailerName' not found", 400);
			}
			$row = $result->fetch_assoc();
			$retailerID = $row['RetailerID'];

			// Check if entry exists
			$stmt = $conn->prepare("SELECT * FROM product_retailers WHERE ProductID = ? AND RetailerID = ?");
			$stmt->bind_param("ii", $productID, $retailerID);
			$stmt->execute();
			$result = $stmt->get_result();
			if ($result->num_rows > 0) {
				$stmt = $conn->prepare("UPDATE product_retailers SET Price = ?, Stock = ? WHERE ProductID = ? AND RetailerID = ?");
				$stmt->bind_param("diii", $retailer['Price'], $retailer['Stock'], $productID, $retailerID);
				if (!$stmt->execute()) {
					$this->respond('error', "Failed to update retailer '$retailerName'", 500);
				}
			} else {
				$stmt = $conn->prepare("INSERT INTO product_retailers (ProductID, RetailerID, Price, Stock) VALUES (?, ?, ?, ?)");
				$stmt->bind_param("iidi", $productID, $retailerID, $retailer['Price'], $retailer['Stock']);
				if (!$stmt->execute()) {
					$this->respond('error', "Failed to add retailer '$retailerName'", 500);
				}
			}
		}
		
		if (isset($data['specifications']) && is_array($data['specifications'])) {
			foreach ($data['specifications'] as $spec) {
				if (!isset($spec['SpecType']) || !isset($spec['SpecValue'])) {
					$this->respond('error', 'Each specification must include SpecType and SpecValue', 400);
				}
				$stmt = $conn->prepare("INSERT INTO specifications (ProductID, SpecType, SpecValue) VALUES (?, ?, ?)");
				$stmt->bind_param("iss", $productID, $spec['SpecType'], $spec['SpecValue']);
				if (!$stmt->execute()) {
					$this->respond('error', 'Failed to add specification', 500);
				}
			}
		}

		$this->respond('success', 'Product, retailers, and categories added/updated successfully', 200);
	}


	private function handleDeleteProduct(){

		$data=$this->data;
		$conn=$this->conn;

		if(!isset($data['ProductID'])){

			$this->respond('error','ProductID parameter missing',400);
		}

		try{

			$conn->begin_transaction();

			$stmt=$conn->prepare('SELECT ProductID FROM products WHERE ProductID=?');

			$stmt->bind_param('i',$data['ProductID']);

			if (!$stmt->execute()) {
				$conn->rollback();
				$this->respond('error', 'Failed to get product', 400);
			}

			$stmt->store_result();
			
			if($stmt->num_rows==0){
				$conn->rollback();
				$this->respond('error', 'Product does not exist', 400);
			}

			$productID=$data['ProductID'];

			$delProduct=$conn->prepare('DELETE FROM products WHERE ProductID = ?');
			$delProduct->bind_param('i',$productID);

			if(!$delProduct->execute()){

				$conn->rollback();
				$this->respond('error','Failed to delete product',500);
			}

			$conn->commit();
			$this->respond('success','Product deleted successfully',200);

		}catch(Exception $error){

			$this->respond('error','Failed to delete product: '.$error->getMessage(),500);
		}

	}

	private function handleLogin(){
		$data=$this->data;
		$conn =$this->conn;

		$email;
		$password;

		$accepted =['type','email','password'];

		foreach($data as  $attr=>$value){
			if(!in_array($attr,$accepted)){
				$this->respond("error","Invalid Parameter",400);//checks if the data recived from the json is valid for the login request to be done 
			}
		}

		if(!isset($data['email'])||!$this->validateEmail($data['email'])){

			$this->respond("error","Invalid or missing email",400);
		}

		if(!isset($data['password'])){

			$this->respond("error","Password missing",400);
		}

		$password=$data['password'];

		if(!$this->userExists($data['email'])){

			$this->respond("error","User does not exist",401);
		}

		$email=$data['email'];

		$stmt=$conn->prepare("SELECT FirstName,LastName,Api_key,Password,Type FROM users WHERE email=?");

		$stmt->bind_param("s",$email);

		if($stmt->execute()){

			$stmt->bind_result($Firstname,$Lastname,$Api_key,$hashedPassword,$user_type);
		
			if($stmt->fetch()){

				if(password_verify($password,$hashedPassword)) {
					
					$this->respond("success",[['apikey'=>$Api_key,'name'=>$Firstname, 'surname'=>$Lastname, 'user_type'=>$user_type]],200);

				}else{
					
					$this->respond("error","Password incorrect",400);
				}

			}

		}else{
			
			$this->respond('error', $stmt->error, 500);
		}
	}

	//Category and Retailer get distinct
	private function getCatOrRet($field){

		$conn=$this->conn;

		$values=[];

		if($field=='Category'){

			$result=$conn->query("SELECT CategoryID, Name FROM categories");

			if(!$result){

				$this->respond('error','Failed to get categories',500);
			}

			while($row=$result->fetch_assoc()){

				$values[$row['CategoryID']]=$row['Name'];
			}

		}else if($field=='Retailer'){

			$result=$conn->query("SELECT RetailerID, RetailerName FROM retailers");

			if(!$result){

				$this->respond('error','Failed to get retailers',500);
			}

			while($row=$result->fetch_assoc()){

				$values[$row['RetailerID']]=$row['RetailerName'];
			}

		}

		return $values;
	}
	
	//Brand and Specification get distinct
	private function getBrandOrSpec($field){

		$conn=$this->conn;

		$values=[];

		if($field=='Brand'){

			$result=$conn->query("SELECT DISTINCT Brand FROM products");

			if(!$result){

				$this->respond('error','Failed to get brands',500);
			}

			while($row=$result->fetch_assoc()){

				$values[]=$row['Brand'];
			}


		}else if($field=='Specification'){

			$result=$conn->query("SELECT DISTINCT SpecType FROM specifications");

			if(!$result){

				$this->respond('error','Failed to get specifications',500);
			}

			while($row=$result->fetch_assoc()){

				$values[]=$row['SpecType'];
			}

		}

		return $values;
	}

	private function handleGetDistinct(){

		$data=$this->data;

		if(!isset($data['field'])){

			$this->respond('error','field parameter missing',400);
		}

		$field=$data['field'];

		switch($field){

			case "Retailer":
			case "Category":
				$values=$this->getCatOrRet($field);
				$this->respond('success',$values,200);
				break;
			
			case "Brand":
			case "Specification":
				$values=$this->getBrandOrSpec($field);
				$this->respond('success',$values,200);
				break;

			default:
				$this->respond('error','Invalid field',400);

		}

	}
	private function handleEditProduct(){
		$data = $this->data;
		$conn = $this->conn;

		if (!isset($data['ProductID'])) {
			$this->respond("error", "Missing ProductID parameter", 400);
			return;
		}

		$productID = $data['ProductID'];

		$stmt = $conn->prepare("SELECT * FROM products WHERE ProductID = ?");
		$stmt->bind_param("i", $productID);
		$stmt->execute();
		$result = $stmt->get_result();

		if ($result->num_rows === 0){
			$this->respond("error", "Product not found", 404);
			return;
		}

		$fieldsToUpdate = [];
		$params = [];
		$types = "";

		if (isset($data['Title'])) {
			$fieldsToUpdate[] = "Title = ?";
			$params[] = $data['Title'];
			$types .= "s";
		}

		if (isset($data['Description'])) {
			$fieldsToUpdate[] = "Description = ?";
			$params[] = $data['Description'];
			$types .= "s";
		}

		if (isset($data['Image_url'])) {
			$fieldsToUpdate[] = "Image_url = ?";
			$params[] = $data['Image_url'];
			$types .= "s";
		}

		if (!empty($fieldsToUpdate)) {
			$query = "UPDATE products SET " . implode(", ", $fieldsToUpdate) . " WHERE ProductID = ?";
			$params[] = $productID;
			$types .= "i";

			$stmt = $conn->prepare($query);
			$stmt->bind_param($types, ...$params);
			$stmt->execute();
		}

		if (isset($data['Retailers']) && is_array($data['Retailers'])){
			foreach ($data['Retailers'] as $retailerData){
				if(!isset($retailerData['RetailerID'], $retailerData['Price'])){
					continue; 
				}

				$retailerID = $retailerData['RetailerID'];
				$price = $retailerData['Price'];

				$checkStmt = $conn->prepare("SELECT * FROM product_retailers WHERE ProductID = ? AND RetailerID = ?");
				$checkStmt->bind_param("ii", $productID, $retailerID);
				$checkStmt->execute();
				$existing = $checkStmt->get_result();

				if ($existing->num_rows > 0){
					$updateStmt = $conn->prepare("UPDATE product_retailers SET Price = ? WHERE ProductID = ? AND RetailerID = ?");
					$updateStmt->bind_param("dii", $price, $productID, $retailerID);
					$updateStmt->execute();
				}else{
					
					$insertStmt = $conn->prepare("INSERT INTO product_retailers (ProductID, RetailerID, Price) VALUES (?, ?, ?)");
					$insertStmt->bind_param("iid", $productID, $retailerID, $price);
					$insertStmt->execute();
				}
			}
		}

    	$this->respond("success", "Product updated successfully", 200);
	}

	private function handleAddReview(){

		$data=$this->data;
		$conn=$this->conn;

		$accepted =['type','apikey','productID','rating','comment'];

		foreach($data as  $attr=>$value){
			if(!in_array($attr,$accepted)){
				$this->respond("error","Invalid Parameter",400);
			}
		}
		
		if(!isset($data['apikey'])){

			$this->respond("error","Apikey missing",400);
		}

		if(!isset($data['productID'])){

			$this->respond("error","ProductID missing",400);
		}

		$productID=$data['productID'];

		if(!isset($data['rating'])){

			$this->respond("error","Rating missing",400);
		}

		$rating=$data['rating'];

		if(!isset($data['comment'])){

			$this->respond("error","Comment missing",400);
		}

		$comment=$data['comment'];

		$auth=$this->checkApiKey($data['apikey']);

		if(!$auth){

			$this->respond('error','Access Unauthorized',401);
		}

		$getUser=$conn->prepare("SELECT UserID FROM users WHERE Api_key=?");

		$getUser->bind_param("s",$data['apikey']);

		$getUser->execute();
		$getUser->store_result();
		$getUser->bind_result($userID);
		$getUser->fetch();
		$getUser->close();

		$stmt=$conn->prepare("INSERT INTO reviews(UserID, ProductID, Rating, Comment, ReviewDate) VALUES(?,?,?,?,NOW())");

		$stmt->bind_param("iiis",$userID,$productID,$rating,$comment);

		if(!$stmt->execute()){

			$this->respond('error','Could not make review',500);
		}

		$stmt->close();

		$this->respond('success','Review Added',200);

	}

	public function handleRequest(){

		$data=$this->data;

		if(isset($data['type'])){

			$reqType=$data['type'];

			switch($reqType){

				case "Register":
					$this->handleRegister();
					break;

				case "GetAllProducts":
					$this->handleGetAllProducts();
					break;

				case "Login":
					$this->handleLogin();
					break;

				case "Favourite":
					$this->handleFavourites();
					break;

				case "GetFavourites":
					$this->handleFavouriteProducts();
					break;

				case "removeFavourite":
					$this->handleRemoveFavourite();
					break;

				case "GetDistinct":
					$this->handleGetDistinct();
					break;

				case "AddReview":
					$this->handleAddReview();
					break;
				
				case "addProduct":
					$this->handleAddProduct();
					break;

				case "RemoveProduct":
					$this->handleDeleteProduct();
					break;

				case "Filter":
					$this->handleFilter();
					break;

				case "editProduct":
					$this->handleEditProduct();
					break;

				default:
					$this->respond('error','Invalid Request Type',400);		
			}
			
		}else{

			$this->respond('error','Type attribute missing',400);
		}

	}

	private function sortProducts($products, $sortBy, $direction='ASC'){
		usort($products, function ($a, $b) use ($sortBy, $direction){
			
			$valA=isset($a[$sortBy])?$a[$sortBy]:0;
			$valB=isset($b[$sortBy])?$b[$sortBy]:0;

			if($valA==$valB) return 0;

			if(strtoupper($direction)==='DESC') {
				return ($valA < $valB)? 1:-1;
			} else {
				return ($valA > $valB)?1:-1;
			}
		});

		return $products;
	}

	private function lowestPrice($product){

		$retailers=$product['Retailers'];

		// If no retailers, return null or a default value
		if (!is_array($retailers) || count($retailers) === 0) {
			return null;
		}

		$lowest=$retailers[0]['Price'];

		foreach($retailers as $r){

			if($r['Price']<$lowest){

				$lowest=$r['Price'];
			}
		}

		return $lowest;
	}

}

$dbConn=Database::instance()->getConnection();
$api=new Api($dbConn);
$api->handleRequest();

?>