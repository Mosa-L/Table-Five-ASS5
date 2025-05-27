<?php 

require_once __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

class Database{

	private $conn;
	public static function instance(){

		static $instance=null;

		if($instance===null){

			$instance=new Database();
		}

		return $instance;
	}

	private function __construct(){

		$host=$_ENV['DB_HOST'];
		$username=$_ENV['DB_USERNAME'];
		$password=$_ENV['DB_PASSWORD'];
		$dbname=$_ENV['DB_NAME'];


		$this->conn=new mysqli($host,$username,$password);

		if($this->conn->connect_error){

			die("Connection failure: ".$this->conn->connect_error);
		}else{

			$this->conn->select_db($dbname);
			error_log("Connection success");
		}
	}

	public function __destruct(){

		$this->conn->close();
	}

	public function getConnection(){

		return $this->conn;
	}

}

?>