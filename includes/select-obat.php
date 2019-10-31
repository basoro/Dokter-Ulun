<?php

/***
* e-Dokter from version 0.1 Beta
* Last modified: 02 Pebruari 2018
* Author : drg. Faisol Basoro
* Email : drg.faisol@basoro.org
*
* File : includes/select-obat.php
* Description : Get databarang data from json encode by select2
* Licence under GPL
***/

ob_start();
session_start();

include_once('../config.php');
 
$q = $_GET['q'];
 
$sql = query("SELECT a.kode_brng AS id, a.nama_brng AS text FROM databarang a WHERE status = '1' AND (a.kode_brng LIKE '%".$q."%' OR a.nama_brng LIKE '%".$q."%')");
//$sql = query("SELECT a.kode_brng AS is, b.nama_brng AS text FROM riwayat_barang_medis a, databarang b WHERE (b.kode_brng LIKE '%".$q."%' OR b.nama_brng LIKE '%".$q."%') AND a.jam IN (SELECT MAX(a.jam) FROM riwayat_barang_medis a WHERE a.tanggal IN (SELECT MAX(a.tanggal) FROM riwayat_barang_medis a))");
$json = [];

while($row = fetch_assoc($sql)){
     $json[] = ['id'=>$row['id'], 'text'=>$row['text']];
}
echo json_encode($json);


?>
