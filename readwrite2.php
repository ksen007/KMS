#!/usr/bin/php-cgi

<?php

//function cors() {
//
//    // Allow from any origin
//    if (isset($_SERVER['HTTP_ORIGIN'])) {
//        // Decide if the origin in $_SERVER['HTTP_ORIGIN'] is one
//        // you want to allow, and if so:
//        header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
//        header('Access-Control-Allow-Credentials: true');
//        header('Access-Control-Max-Age: 86400');    // cache for 1 day
//    }
//
//    // Access-Control headers are received during OPTIONS requests
//    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
//
//        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
//            // may also be using PUT, PATCH, HEAD etc
//            header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
//
//        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
//            header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
//
//        exit(0);
//    }
//}


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
  if(array_key_exists('password',$_POST) && array_key_exists('oldFile',$_POST) && array_key_exists('newPassword',$_POST) && array_key_exists('file', $_POST)){
    $file = $_POST['file'];
    if ((!file_exists($file) && matchPassword($_POST['oldFile'], $_POST['password'])) || (file_exists($file) && matchPassword($file, $_POST['password']))) {
     if (array_key_exists('content',$_POST)) {
       if (!file_exists(dirname($file))){
	 $success = mkdir(dirname($file), 0700, TRUE);
       }
       $success = file_put_contents($file, $_POST['content']."<!--PASSWORD(".password_hash($_POST['newPassword'],PASSWORD_DEFAULT).")-->");
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
	 $message = 'content field missing in request.';
     }
   } else {
    $content = FALSE;
    $success = FALSE;
    if (file_exists($file)) {
      $message = 'Overwrite failed.  Access denied to file due to wrong password in existing file : '.$_POST['file'];
    } else {
      $message = 'Access denied to file due to wrong password in old file : '.$_POST['oldFile'];
    }
   }
  } else {
    $content = FALSE;
    $success = FALSE;
    $message = 'password, newPassword, file, or oldFile field is non-existent: '.$_POST['file'];
  }
} else if (array_key_exists('action',$_POST) && $_POST['action'] == 'remove') {
  if (array_key_exists('password',$_POST) && array_key_exists('oldFile',$_POST)) {
    if (matchPassword($_POST['oldFile'], $_POST['password'])) {
      $resp = unlink($_POST['oldFile']);
      if ($resp) {
	    $content = '';
	    $success = TRUE;
	    $message = 'Deleted file: '.$_POST['oldFile'];
      } else {
	    $content = FALSE;
	    $success = FALSE;
	    $message = 'Failed to delete file: '.$_POST['oldFile'];
      }
    } else {
      $content = FALSE;
      $success = FALSE;
      $message = 'File upload failed due to wrong password in the file :'.$_POST['oldFile'];
    }
  } else {
    $content = FALSE;
    $success = FALSE;
    if (!array_key_exists('password',$_POST)) {
      $message = 'File deletion failed due to non-existent password: '.$_POST['oldFile'];
    } else {
      $message = 'File deletion failed because oldFile field is missing: '.$_POST['oldFile'];
    }
  }
} else if (array_key_exists('action',$_POST) && $_POST['action'] == 'upload') {
  if (array_key_exists('password',$_POST) && array_key_exists('oldFile',$_POST)) {
    if (matchPassword($_POST['oldFile'], $_POST['password'])) {
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
      $message = 'File upload failed due to wrong password in the old file : '.$_POST['oldFile'];
    }
  } else {
    $content = FALSE;
    $success = FALSE;
    if (!array_key_exists('password',$_POST)) {
      $message = 'File upload failed due to non-existent password: '.$_FILES['uploaded']['name'];
    } else {
      $message = 'File upload failed because oldFile field is missing: '.$_FILES['uploaded']['name'];
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

