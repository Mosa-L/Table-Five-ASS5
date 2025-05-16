<?php
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

	private function addUser($name,$surname,$email,$password,$user_type){

		$conn=$this->conn;

		$add=$conn->prepare("INSERT INTO u24874478_users (Email,Password,FirstName,LastName,Type,Api_key) VALUES(?,?,?,?,?,?)");

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

	private function buildQuery($data){

		$conn=$this->conn;

		$validFields=['ProductID', 'Title', 'Brand', 'Description', 'Image_url'];

		$sortFields=['Product','Title','Brand'];
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

		if(!isset($data['apikey'])){

			$this->respond("error","Apikey missing",400);
		}

		$auth=$this->checkApiKey($data['apikey']);

		if(!$auth){

			$this->respond('error','Access Unauthorized',401);
		}

		$products=$this->buildQuery($data);

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
			$stmt->execute();
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
			$stmt->execute();
			$result=$stmt->get_result();

			$specs=[];
			while($row=$result->fetch_assoc()){

				$specs[$row['SpecType']]=$row['SpecValue'];
			}

			$product['Specifications']=$specs;
			$stmt->close();
		}
    	unset($product);

		

		// $this->changePrices($products,'ZAR',$this->currencies);

		if(isset($data['search'])){

			$search=$data['search'];

			//Search for price max & min
			foreach($search as $attr=>$term){

					if ($attr=='price_min'){
						$products = array_filter($products, function($p) use ($term) {
							return isset($p['final_price']) && $p['final_price']>=$term;
						});

					} else if ($attr=='price_max'){
						$products = array_filter($products, function($p) use ($term) {
							return isset($p['final_price']) && $p['final_price']<=$term;
						});
					}
			}

		}

		//Sort for prices
		if(isset($data['sort'])&&($data['sort']=='initial_price'||$data['sort']=='final_price')){

			if(isset($data['order'])){

				$products=$this->sortProducts($products,$data['sort'],$data['order']);

			}else{

				$products=$this->sortProducts($products,$data['sort']);
			}	
		}

		//Remove currency if necessary
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
		$user_type=$data['type'];

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
	private function handleLogin(){
		$data=$this->data;
		$conn =$this->conn;

		$email;
		$password;

		$accepted =['type','email','passord'];

		foreach($data as  $attr=>$value){
			if(!in_array($attr,$accepted)){
				$this->respond("error","Invalid Parameter",400);//checks if the data recived from the json is valid for the login request to be done 
			}
		}

		if(!isset($data['email'])||!$this->validateEmail($data['email'])){

		$this->respond("error","Invalid or missing email",400);
		}

		if(!isset($data['password'])||!$this->validatePassword($data['password'])){

			$this->respond("error","Password format insufficient, unsafe.",400);
		}

		$password=$data['password'];

		if(!$this->userExists($this->conn,$data['email'])){

		$this->respond("error","User does not exist",401);
		}

		$email=$data['email'];

		$stmt=$conn->prepare("SELECT Firstname,Lastname,Api_key FROM users WHERE email=?");

		$stmt->bind_param("s",$email);

		if($stmt->execute()){

			$stmt->bind_result($Firstname,$Api_key,$Lastname);
		
			if($stmt->fetch()){

				if(password_verify($password,$hashedPassword)) {
					
					$this->respond("success",[['apikey'=>$apikey,'name'=>$Firstname, 'surname'=>$Lastname]],200);

				}else{
					
					$this->respond("error","Password incorrect",400);
				}

			}

		}else{
			
			$this->respond('error', $stmt->error, 500);
		}
	}

	public function handleRequest(){

		$data=$this->data;

		if(isset($data['type'])){

			$reqType=$data['type'];

			$this->fetchCurrencies();

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
					$this->handleFavourite();
					break;

				case "GetFavourites":
					$this->handleFavouriteProducts();
					break;

				case "Save":
					$this->handleSave();
					break;

				default:
					$this->respond('error','Invalid Request Type',400);		
			}
			
		}else{

			$this->respond('error','Type attribute missing',400);
		}

	}

}

$dbConn=Database::instance()->getConnection();
$api=new Api($dbConn);
$api->handleRequest();

?>