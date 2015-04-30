#!/usr/bin/php-cgi

<?php header('Access-Control-Allow-Origin: *'); ?>

<?php
function startsWith($haystack, $needle) {
    // search backwards starting from haystack length characters from the end
    return $needle === "" || strrpos($haystack, $needle, -strlen($haystack)) !== FALSE;
}

$salt = 'lr';
$cpassword = 'your password here';

if (array_key_exists('action',$_POST) && $_POST['action'] == 'read' ){
    	if (array_key_exists('file', $_POST) && file_exists($_POST['file']) && 
		(!(stripos($_POST['file'],'../') || !startsWith($_POST['file'],'hpage/')) 
			|| (array_key_exists('password',$_POST) && crypt($_POST['password'],$salt) == $cpassword))) {
        	$content = file_get_contents($_POST['file']);
    	} else {
        	$content = FALSE;
    	}
    	$advert = array(
        	'data' => $content,
     	);
    	echo json_encode($advert);
} else if (array_key_exists('action',$_POST) && $_POST['action'] == 'write' && array_key_exists('password',$_POST) && crypt($_POST['password'],$salt) == $cpassword) {
     	if (array_key_exists('file', $_POST) && array_key_exists('content',$_POST)) {
	 	$file = $_POST['file'];
	 	if (!file_exists(dirname($file))){
			mkdir(dirname($file), 0700, TRUE);
	 	}
         	$resp = file_put_contents($file, $_POST['content']);
    	} else {
	 	$resp = FALSE;
	}
    	$advert = array(
        	'data' => $resp
     	);
    	echo json_encode($advert);
} else if (array_key_exists('action',$_POST) && $_POST['action'] == 'remove' && array_key_exists('password',$_POST) && crypt($_POST['password'],$salt) == $cpassword) {
    	if (array_key_exists('file', $_POST)) {
        	$resp = unlink($_POST['file']);
    	} else {
		$resp = FALSE;
	}
    	$advert = array(
        	'data' => $resp
     	);
    	echo json_encode($advert);
} else if (array_key_exists('action',$_POST) && $_POST['action'] == 'upload' && array_key_exists('password',$_POST) && crypt($_POST['password'],$salt) == $cpassword) {
        if (array_key_exists('directory',$_POST) && $_POST['directory'] != ''){
                $target = $_POST['directory'];
        } else {                
		$target = ".";   
        }
	if (!file_exists($target)){
		mkdir($target, 0700, TRUE);
	}
        $target = $target .'/'. basename( $_FILES['uploaded']['name']) ;  
        if(move_uploaded_file($_FILES['uploaded']['tmp_name'], $target))  { 
		$resp = TRUE;
        } else {
		$resp = FALSE;
	} 
        $advert = array(
        	'data' => $resp
        );
        echo json_encode($advert);
} else {
        $advert = array(
        	'data' => FALSE
        );
        echo json_encode($advert);
}

?>
