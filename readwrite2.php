#!/usr/bin/php-cgi

   <?php

header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, must-revalidate');
#header('Expires: Mon, 01 Jan 1996 00:00:00 GMT');

header('Content-type: text/plain');

?>

<?php
require('password.php');

function matchPassword($file, $password) {
        $content = file_get_contents($file);
        if (preg_match("/<!--PASSWORD\(([^\)]*)\)-->/", $content, $matches)){
                return password_verify($password, $matches[1]);
        } else {
                return FALSE;
        }
}


function startsWith($haystack, $needle) {
  // search backwards starting from haystack length characters from the end
  return $needle === "" || strrpos($haystack, $needle, -strlen($haystack)) !== FALSE;
}

$salt = 'lr';
$cpassword = 'your crypted password';

if (array_key_exists('action',$_POST) && $_POST['action'] == 'read' ){
  if (array_key_exists('file', $_POST) && file_exists($_POST['file'])) {
    if ((!(stripos($_POST['file'],'../') || !startsWith($_POST['file'],'hpage/'))
	 || (array_key_exists('password',$_POST) && crypt($_POST['password'],$salt) == $cpassword))) {
        $content = file_get_contents($_POST['file']);
        if ($content) {
	        $success = TRUE;
	        $message = 'File found: '.$_POST['file'];
        } else {
	        $content= FALSE;
	        $success = FALSE;
	        $message = 'Unable to read file: '.$_POST['file'];
        }
    } else {
      $content = FALSE;
      $success = FALSE;
      if (!array_key_exists('password',$_POST)) {
	    $message = 'Access denied to file due to non-existent password: '.$_POST['file'];
      } else {
	    $message = 'Access denied to file due to wrong password: '.$_POST['file'];
      }
    }
  } else {
    $content = FALSE;
    $success = FALSE;
    $message = 'File not found: '.$_POST['file'];
  }
} else if (array_key_exists('action',$_POST) && $_POST['action'] == 'write') {
  if(array_key_exists('password',$_POST) && crypt($_POST['password'],$salt) == $cpassword) {
    if (array_key_exists('file', $_POST) && array_key_exists('content',$_POST)) {
      $file = $_POST['file'];
      if (!file_exists(dirname($file))){
	$success = mkdir(dirname($file), 0700, TRUE);
      }
      $success = file_put_contents($file, $_POST['content']);
      if ($success) {
	$content = '';
	$success = TRUE;
	$message = 'File modified: '.$_POST['file'];
      } else {
	$content = FALSE;
	$success = FALSE;
	$message = 'Cannot modify file: '.$_POST['file'];
      }
    } else {
      $content = FALSE;
      $success = FALSE;
      if (array_key_exists('file', $_POST)) {
	$message = 'file field missing in request.';
      } else {
	$message = 'content field missing in request.';
      }
    }
  } else {
    $content = FALSE;
    $success = FALSE;
    if (!array_key_exists('password',$_POST)) {
      $message = 'Access denied to file due to non-existent password: '.$_POST['file'];
    } else {
      $message = 'Access denied to file due to wrong password: '.$_POST['file'];
    }
  }
} else if (array_key_exists('action',$_POST) && $_POST['action'] == 'remove') {
  if (array_key_exists('password',$_POST) && crypt($_POST['password'],$salt) == $cpassword) {
    if (array_key_exists('file', $_POST)) {
      $resp = unlink($_POST['file']);
      if ($resp) {
	$content = '';
	$success = TRUE;
	$message = 'Deleted file: '.$_POST['file'];
      } else {
	$content = FALSE;
	$success = FALSE;
	$message = 'Failed to delete file: '.$_POST['file'];
      }
    } else {
      $content = FALSE;
      $success = FALSE;
      $message = 'file field missing in request.';
    }
  } else {
    $content = FALSE;
    $success = FALSE;
    if (!array_key_exists('password',$_POST)) {
      $message = 'File deletion failed due to non-existent password: '.$_POST['file'];
    } else {
      $message = 'File deletion failed due to wrong password: '.$_POST['file'];
    }
  }
} else if (array_key_exists('action',$_POST) && $_POST['action'] == 'upload') {
  if (array_key_exists('password',$_POST) && crypt($_POST['password'],$salt) == $cpassword) {
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
      $content = '';
      $success = TRUE;
      $message = 'Uploaded file: '.$_FILES['uploaded']['name'];
    } else {
      $content = FALSE;
      $success = FALSE;
      $message = 'Failed to upload file: '.$_FILES['uploaded']['name'];
    }
  } else {
    $content = FALSE;
    $success = FALSE;
    if (!array_key_exists('password',$_POST)) {
      $message = 'File upload failed due to non-existent password: '.$_FILES['uploaded']['name'];
    } else {
      $message = 'File upload failed due to wrong password: '.$_FILES['uploaded']['name'];
    }
  }
} else {
  $content = FALSE;
  $success = FALSE;
  if (array_key_exists('action', $_POST)) {
    $message = "Unknown action ".$_POST['action'];
  } else {
    $message = "action not specified.";
  }
}

$advert = array(
		'data' => $content,
		'message' => $message,
		'success' => $success
		);
echo json_encode($advert);

?>

