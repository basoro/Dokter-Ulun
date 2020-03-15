<ul class="nav nav-tabs m-b-30" role="tablist">
  <li role="presentation"><a href="#resep" aria-controls="5" role="tab" data-toggle="tab">Umum</a></li>
  <li role="presentation"><a href="#racikan" aria-controls="6" role="tab" data-toggle="tab">Racikan</a></li>
</ul>

<?php
if (isset($_POST['ok_racikan'])) {

    if(empty($_POST['nama_racikan'])) {
      $errors[] = 'Maaf nama racikan tidak boleh kosong';
    }

    if(empty($_POST['jumlah'])) {
      $errors[] = 'Maaf jumlah racikan tidak boleh kosong';
    }

    /*$get_kode_brng = $_POST['kode_brng_racikan'];
    for ($i = 0; $i < count($get_kode_brng); $i++) {
        $kode_brng = $get_kode_brng[$i];

        $get_obatmaxtgl = fetch_assoc(query("SELECT MAX(tanggal) AS tanggal FROM riwayat_barang_medis WHERE kode_brng = '$kode_brng' AND kd_bangsal = 'B0014'"));
        $get_obatmaxjam = fetch_assoc(query("SELECT MAX(jam) AS jam FROM riwayat_barang_medis WHERE kode_brng = '$kode_brng' AND tanggal = '{$get_obatmaxtgl['tanggal']}' AND kd_bangsal = 'B0014'"));
        $get_obatstok = fetch_assoc(query("SELECT * FROM riwayat_barang_medis WHERE kode_brng = '$kode_brng' AND tanggal = '{$get_obatmaxtgl['tanggal']}' AND jam = '{$get_obatmaxjam['jam']}' AND kd_bangsal = 'B0014'"));
        $get_nama_brng = fetch_assoc(query("SELECT nama_brng FROM databarang WHERE kode_brng = '$kode_brng'"));

        if($get_obatstok['stok_akhir'] < 10 ) {
          $errors[] = 'Maaf stok obat '.$get_nama_brng['nama_brng'].' di depo rawat jalan tidak mencukupi';
        }

    }
    */
    if(!empty($errors)) {
        foreach($errors as $error) {
            echo validation_errors($error);
        }
    } else {

        $onhand = query("SELECT no_resep FROM resep_obat WHERE no_rawat = '{$no_rawat}' AND tgl_peresepan = '{$date}'");
        $dtonhand = fetch_array($onhand);
        $get_number = fetch_array(query("select ifnull(MAX(CONVERT(RIGHT(no_resep,4),signed)),0) from resep_obat where tgl_perawatan like '%{$date}%'"));
        $lastNumber = substr($get_number[0], 0, 4);
        $_next_no_resep = sprintf('%04s', ($lastNumber + 1));
        $tgl_resep = date('Ymd');
        $next_no_resep = $tgl_resep.''.$_next_no_resep;


        if ($dtonhand['0'] > 1) {
          $get_no_racik = fetch_array(query("SELECT MAX(no_racik) FROM resep_dokter_racikan WHERE no_resep = '{$dtonhand['0']}'"));
          $next_no_racik = $get_no_racik['0'] + 1;
          if ($_POST['aturan_pakai_lainnya'] == "") {
            $insert = query("INSERT INTO resep_dokter_racikan VALUES ('{$dtonhand['0']}', '$next_no_racik', '{$_POST['nama_racikan']}', '{$_POST['kd_racik']}', '{$_POST['jumlah']}', '{$_POST['aturan_pakai']}', '{$_POST['keterangan']}')");
          } else {
            $insert = query("INSERT INTO resep_dokter_racikan VALUES ('{$dtonhand['0']}', '$next_no_racik', '{$_POST['nama_racikan']}', '{$_POST['kd_racik']}', '{$_POST['jumlah']}', '{$_POST['aturan_pakai_lainnya']}', '{$_POST['keterangan']}')");
          }
          /*if($insert) {
            $insert_resep = '';
            $get_kode_brng = $_POST['kode_brng_racikan'];
            for ($i = 0; $i < count($get_kode_brng); $i++) {
                $kode_brng = $get_kode_brng[$i];
                query("INSERT INTO resep_dokter_racikan_detail VALUES ('{$dtonhand['0']}', '$next_no_racik', '{$kode_brng}', '1', '1', '10', '20')");
                redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}#racikan");
            }

          }*/
          redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}#racikan");
        } else {
            $insert = query("INSERT INTO resep_obat VALUES ('{$next_no_resep}', '{$date}', '{$time}', '{$no_rawat}', '{$_SESSION['username']}', '{$date}', '{$time}', '{$status_lanjut}')");
            if ($_POST['aturan_pakai_lainnya'] == "") {
              $insert = query("INSERT INTO resep_dokter_racikan VALUES ('{$next_no_resep}', '1', '{$_POST['nama_racikan']}', '{$_POST['kd_racik']}', '{$_POST['jumlah']}', '{$_POST['aturan_pakai']}', '{$_POST['keterangan']}')");
            } else {
              $insert = query("INSERT INTO resep_dokter_racikan VALUES ('{$next_no_resep}', '1', '{$_POST['nama_racikan']}', '{$_POST['kd_racik']}', '{$_POST['jumlah']}', '{$_POST['aturan_pakai_lainnya']}', '{$_POST['keterangan']}')");
            }
            /*if($insert) {
              $insert_resep = '';
              $get_kode_brng = $_POST['kode_brng_racikan'];
              for ($i = 0; $i < count($get_kode_brng); $i++) {
                  $kode_brng = $get_kode_brng[$i];
                  query("INSERT INTO resep_dokter_racikan_detail VALUES ('{$next_no_resep}', '$next_no_racik', '{$kode_brng}', '1', '1', '10', '20')");
                  redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}#racikan");
              }

            }*/
            redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}#racikan");
        }
    }
}
?>

<?php
if (isset($_POST['ok_copyresep'])) {
      $get_number = fetch_array(query("select ifnull(MAX(CONVERT(RIGHT(no_resep,4),signed)),0) from resep_obat where tgl_perawatan like '%{$date}%'"));
      $lastNumber = substr($get_number[0], 0, 4);
      $_next_no_resep = sprintf('%04s', ($lastNumber + 1));
      $tgl_resep = date('Ymd');
      $next_no_resep = $tgl_resep.''.$_next_no_resep;

      $onhand = query("SELECT no_resep FROM resep_obat WHERE no_rawat = '{$no_rawat}' AND tgl_peresepan = '{$date}'");
      $dtonhand = fetch_array($onhand);

      if ($dtonhand['no_resep'] == 0) {
        $insert = query("INSERT INTO resep_obat VALUES ('{$next_no_resep}', '{$date}', '{$time}', '{$no_rawat}', '{$_SESSION['username']}', '{$date}', '{$time}', '{$status_lanjut}')");
      } else {
        $next_no_resep = $dtonhand['no_resep'];
      }

      $insert_resep = '';
      $get_kode_brng = $_POST['kode_brng_copyresep'];
      $get_jml= $_POST['jml_copyresep'];
      $get_aturan= $_POST['aturan_copyresep'];
      for ($i = 0; $i < count($get_kode_brng); $i++) {
          $kode_brng = $get_kode_brng[$i];
          $jml = $get_jml[$i];
          $aturan = $get_aturan[$i];

          $get_obatmaxtgl = fetch_assoc(query("SELECT MAX(tanggal) AS tanggal FROM riwayat_barang_medis WHERE kode_brng = '$kode_brng' AND kd_bangsal = 'B0014'"));
          $get_obatmaxjam = fetch_assoc(query("SELECT MAX(jam) AS jam FROM riwayat_barang_medis WHERE kode_brng = '$kode_brng' AND tanggal = '{$get_obatmaxtgl['tanggal']}' AND kd_bangsal = 'B0014'"));
          $get_obatstok = fetch_assoc(query("SELECT * FROM riwayat_barang_medis WHERE kode_brng = '$kode_brng' AND tanggal = '{$get_obatmaxtgl['tanggal']}' AND jam = '{$get_obatmaxjam['jam']}' AND kd_bangsal = 'B0014'"));
          $get_nama_brng = fetch_assoc(query("SELECT nama_brng FROM databarang WHERE kode_brng = '$kode_brng'"));

          if($get_obatstok['stok_akhir'] < 1 ) {
          	$errors = 'Maaf stok obat '.$get_nama_brng['nama_brng'].' di depo rawat jalan tidak mencukupi';
          }

          if(!empty($errors)) {
              //foreach($errors as $error) {
                  echo validation_errors($errors);
              //}
          } else {
            query("INSERT INTO resep_dokter VALUES ('{$next_no_resep}', '{$kode_brng}', '{$jml}', '{$aturan}')");
            redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}#racikan");
          }
      }
}
?>

<?php
  $copyresep = isset($_GET['copyresep'])?$_GET['copyresep']:null;

  if($copyresep) {
?>
<form method="post">
  <div class="table-responsive">
   <table class="table table-striped">
      <thead>
          <tr>
              <th>Jml</th>
              <th>Nama Obat</th>
              <th>Aturan Pakai</th>
          </tr>
      </thead>
      <tbody>
        <?php
        $copy_query_resep = query("SELECT databarang.nama_brng, resep_dokter.jml, resep_dokter.aturan_pakai, resep_dokter.kode_brng FROM resep_dokter, databarang WHERE resep_dokter.no_resep = '$_GET[copyresep]' AND resep_dokter.kode_brng = databarang.kode_brng");
        $i = 0;
        while ($copy_data_resep = fetch_array($copy_query_resep)) {
        ?>
            <tr>
                <td><input type="text" name="jml_copyresep[]" multiple="multiple" value="<?php echo $copy_data_resep['1']; ?>" size="5"></td>
                <td><input type="hidden" name="kode_brng_copyresep[]" multiple="multiple" value="<?php echo $copy_data_resep['3']; ?>"><?php echo $copy_data_resep['0']; ?></td>
                <td><input type="hidden" name="aturan_copyresep[]" multiple="multiple" value="<?php echo $copy_data_resep['2']; ?>"><?php echo $copy_data_resep['2']; ?></td>
            </tr>
        <?php
        $i++;
        }
        ?>
      </tbody>
    </table>
  </div>
  <br>
  <button type="submit" name="ok_copyresep" value="ok_copyresep" class="btn bg-indigo waves-effect" onclick="this.value=\'ok_copyresep\'">SIMPAN</button>
</form>
<?php
  } else {
?>
<form method="post">
<dl class="dl-horizontal">
    <dt>Nama Racikan</dt>
    <dd><input class="form-control" name="nama_racikan" style="width:100%"></dd><br>
    <dt>Metode Racik</dt>
    <dd>
      <select name="kd_racik" class="metode_racik" style="width:100%">
        <?php
        $sql = query("SELECT * FROM metode_racik");
        while($row = fetch_array($sql)){
            echo '<option value="'.$row[0].'">'.$row[1].'</option>';
        }
        ?>
      </select>
    </dd><br>
    <dt>Jumlah Racikan</dt>
    <dd><input class="form-control" name="jumlah" value="10" style="width:100%"></dd><br>
    <dt>Aturan Pakai</dt>
    <dd>
        <select name="aturan_pakai" class="aturan_pakai" id="lainnya_racikan" style="width:100%">
        <?php
        $sql = query("SELECT aturan FROM master_aturan_pakai");
        while($row = fetch_array($sql)){
            echo '<option value="'.$row[0].'">'.$row[0].'</option>';
        }
        ?>
        <option value="lainnya_racikan">Lainnya</option>
        </select>
    </dd><br>
    <div id="row_dim_racikan">
    <dt></dt>
    <dd><input class="form-control" name="aturan_pakai_lainnya" style="width:100%"></dd><br>
    </div>
    <dt>Keterangan</dt>
    <dd><input class="form-control" name="keterangan" style="width:100%"></dd><br>
    <dt></dt>
    <dd><button type="submit" name="ok_racikan" value="ok_racikan" class="btn bg-indigo waves-effect" onclick="this.value=\'ok_racikan\'">SIMPAN</button></dd><br>
    <dt></dt>
</dl>
</form>

<?php
$query_resep = query("SELECT a.*, b.tgl_peresepan, b.jam_peresepan, c.nm_racik FROM resep_dokter_racikan a, resep_obat b, metode_racik c WHERE a.no_resep = b.no_resep AND b.no_rawat = '{$no_rawat}' AND b.kd_dokter = '{$_SESSION['username']}' AND a.kd_racik = c.kd_racik");
if(num_rows($query_resep) > 0) {
?>
<div class="table-responsive">
<table class="table table-striped">
<thead>
    <tr>
        <th>No. Resep & Tanggal</th>
        <th>Nama Racikan</th>
        <th>Metode Racik</th>
        <th>Jumlah</th>
        <th>Aturan Pakai</th>
        <th>Keterangan</th>
    </tr>
</thead>
<tbody>
<?php
while ($data_resep = fetch_array($query_resep)) {
?>
    <tr>
        <td><?php echo $data_resep['no_resep']; ?> <a class="btn btn-danger btn-xs" href="<?php $_SERVER['PHP_SELF']; ?>?action=delete_racikan&no_racik=<?php echo $data_resep['no_racik']; ?>&no_resep=<?php echo $data_resep['no_resep']; ?>&no_rawat=<?php echo $no_rawat; ?>">[X]</a><br><?php echo $data_resep['tgl_peresepan']; ?> <?php echo $data_resep['jam_peresepan']; ?></td>
        <td>
          <strong><?php echo $data_resep['no_racik']; ?>. <?php echo $data_resep['nama_racik']; ?></strong>
          <ul class="list-unstyled">
            <?php
            $query = query("SELECT databarang.nama_brng, resep_dokter_racikan_detail.jml FROM resep_dokter_racikan_detail, databarang WHERE resep_dokter_racikan_detail.no_resep = '{$data_resep['no_resep']}' AND resep_dokter_racikan_detail.no_racik = '{$data_resep['no_racik']}' AND resep_dokter_racikan_detail.kode_brng = databarang.kode_brng");
            while ($row = fetch_array($query)) {
              echo '<li>'.$row['jml'].' - '.$row['nama_brng'].'</li>';
            }
            ?>
          </ul>
        </td>
        <td><?php echo $data_resep['nm_racik']; ?></td>
        <td><?php echo $data_resep['jml_dr']; ?></td>
        <td><?php echo $data_resep['aturan_pakai']; ?></td>
        <td><?php echo $data_resep['keterangan']; ?></td>
    </tr>
<?php
}
?>
</tbody>
</table>
</div>
<?php } ?>
<?php }
    if(!$copyresep) {
    $query_resep = query("SELECT a.kode_brng, a.jml, a.aturan_pakai, b.nama_brng, a.no_resep, c.tgl_peresepan, c.jam_peresepan FROM resep_dokter a, databarang b, resep_obat c WHERE a.kode_brng = b.kode_brng AND a.no_resep = c.no_resep AND c.no_rawat = '{$no_rawat}' AND c.kd_dokter = '{$_SESSION['username']}'");
    if(num_rows($query_resep) > 0) {
?>
<div class="table-responsive">
 <table class="table table-striped">
    <thead>
        <tr>
            <th>Nama Obat</th>
            <th>Tanggal/Jam</th>
            <th>Jumlah</th>
            <th>Aturan Pakai</th>
        </tr>
    </thead>
    <tbody>
    <?php
    while ($data_resep = fetch_array($query_resep)) {
    ?>
        <tr>
            <td><?php echo $data_resep['3']; ?> <a class="btn btn-danger btn-xs" href="<?php $_SERVER['PHP_SELF']; ?>?action=delete_obat&kode_obat=<?php echo $data_resep['0']; ?>&no_resep=<?php echo $data_resep['4']; ?>&no_rawat=<?php echo $no_rawat; ?>">[X]</a></td>
            <td><?php echo $data_resep['5']; ?> <?php echo $data_resep['6']; ?></td>
            <td><?php echo $data_resep['1']; ?></td>
            <td><?php echo $data_resep['2']; ?></td>
        </tr>
    <?php
    }
    ?>
    </tbody>
</table>
</div>
<br>
<?php } ?>
<hr>
<h4>Riwayat Peresepan Racikan</h4>
<?php
//$sql_resep = query("SELECT resep_obat.no_resep, resep_obat.tgl_peresepan FROM reg_periksa, resep_obat WHERE reg_periksa.no_rkm_medis = '$no_rkm_medis' AND reg_periksa.no_rawat = resep_obat.no_rawat AND resep_obat.kd_dokter = '{$_SESSION['username']}'");

$query_resep = query("SELECT a.*, b.tgl_peresepan, b.jam_peresepan, c.nm_racik FROM resep_dokter_racikan a, resep_obat b, metode_racik c, reg_periksa d WHERE a.no_resep = b.no_resep AND b.no_rawat = d.no_rawat AND b.tgl_peresepan != '$date' AND d.no_rkm_medis = '$no_rkm_medis' AND b.kd_dokter = '{$_SESSION['username']}' AND a.kd_racik = c.kd_racik");
if(num_rows($query_resep) > 0) {
?>
<div class="table-responsive">
<table class="table table-striped">
<thead>
    <tr>
        <th>No. Resep & Tanggal</th>
        <th>Nama Racikan</th>
        <th>Metode Racik</th>
        <th>Jumlah</th>
        <th>Aturan Pakai</th>
        <th>Keterangan</th>
    </tr>
</thead>
<tbody>
<?php
while ($data_resep = fetch_array($query_resep)) {
?>
    <tr>
        <td><?php echo $data_resep['no_resep']; ?> <br>[<?php echo $data_resep['tgl_peresepan']; ?> <?php echo $data_resep['jam_peresepan']; ?>]</td>
        <td>
          <strong><?php echo $data_resep['no_racik']; ?>. <?php echo $data_resep['nama_racik']; ?> <span class="right"><a href="<?php echo $_SERVER['PHP_SELF']; ?>?action=view&no_rawat=<?php echo $no_rawat;?>&copyresep=<?php echo $row['0']; ?>#resep" class="btn btn-xs btn-primary">Copy Racikan</a></span></strong>
          <ul class="list-unstyled">
            <?php
            $query = query("SELECT databarang.nama_brng, resep_dokter_racikan_detail.jml FROM resep_dokter_racikan_detail, databarang WHERE resep_dokter_racikan_detail.no_resep = '{$data_resep['no_resep']}' AND resep_dokter_racikan_detail.no_racik = '{$data_resep['no_racik']}' AND resep_dokter_racikan_detail.kode_brng = databarang.kode_brng");
            while ($row = fetch_array($query)) {
              echo '<li>'.$row['jml'].' - '.$row['nama_brng'].'</li>';
            }
            ?>
          </ul>
        </td>
        <td><?php echo $data_resep['nm_racik']; ?></td>
        <td><?php echo $data_resep['jml_dr']; ?></td>
        <td><?php echo $data_resep['aturan_pakai']; ?></td>
        <td><?php echo $data_resep['keterangan']; ?></td>
    </tr>
<?php
}
?>
</tbody>
</table>
</div>
<?php
  }
}
?>
