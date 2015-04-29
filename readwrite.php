#!/usr/bin/php-cgi

<?php header('Access-Control-Allow-Origin: *'); ?>

<?php
$salt = 'lr';
$cpassword = 'password hash should be here';

if (array_key_exists('action',$_POST) && $_POST['action'] == 'read' && (!array_key_exists('password',$_POST) || crypt($_POST['password'],$salt) == $cpassword)) {
    if (array_key_exists('file', $_POST) && file_exists('hpage/'.$_POST['file'])) {
        $content = file_get_contents('hpage/'.$_POST['file']);
    } else {
        $content = 'No content';
    }
    $advert = array(
        'data' => $content
     );
    echo json_encode($advert);
} else if (array_key_exists('action',$_POST) && $_POST['action'] == 'write' && array_key_exists('password',$_POST) && crypt($_POST['password'],$salt) == $cpassword) {
    if (array_key_exists('file', $_POST) && array_key_exists('content',$_POST)) {
        file_put_contents('hpage/'.$_POST['file'], $_POST['content']);
    }
    $advert = array(
        'data' => 'true'
     );
    echo json_encode($advert);
} else if (array_key_exists('action',$_POST) && $_POST['action'] == 'remove' && array_key_exists('password',$_POST) && crypt($_POST['password'],$salt) == $cpassword) {
    if (array_key_exists('file', $_POST)) {
        unlink('hpage/'.$_POST['file']);
    }
    $advert = array(
        'data' => 'true'
     );
    echo json_encode($advert);
}

?>
