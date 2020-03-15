<ul class="nav nav-tabs m-b-30" role="tablist">
  <li role="presentation"><a href="#resep" aria-controls="5" role="tab" data-toggle="tab">Umum</a></li>
  <li role="presentation"><a href="#racikan" aria-controls="6" role="tab" data-toggle="tab">Racikan</a></li>
</ul>

  <?php
  if (isset($_POST['ok_obat'])) {
      if (($_POST['kode_obat'] <> "") and ($no_rawat <> "")) {

          $get_obatmaxtgl = fetch_assoc(query("SELECT MAX(tanggal) AS tanggal FROM riwayat_barang_medis WHERE kode_brng = '{$_POST['kode_obat']}' AND kd_bangsal = 'B0014'"));
          $get_obatmaxjam = fetch_assoc(query("SELECT MAX(jam) AS jam FROM riwayat_barang_medis WHERE kode_brng = '{$_POST['kode_obat']}' AND tanggal = '{$get_obatmaxtgl['tanggal']}' AND kd_bangsal = 'B0014'"));
          $get_obatstok = fetch_assoc(query("SELECT * FROM riwayat_barang_medis WHERE kode_brng = '{$_POST['kode_obat']}' AND tanggal = '{$get_obatmaxtgl['tanggal']}' AND jam = '{$get_obatmaxjam['jam']}' AND kd_bangsal = 'B0014'"));

          if($get_obatstok['stok_akhir'] < 1 ) {
          	$errors[] = 'Maaf stok obat di depo rawat jalan tidak mencukupi';
          }

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
                if ($_POST['aturan_pakai_lainnya'] == "") {
                  $insert = query("INSERT INTO resep_dokter VALUES ('{$dtonhand['0']}', '{$_POST['kode_obat']}', '{$_POST['jumlah']}', '{$_POST['aturan_pakai']}')");
                } else {
                  $insert = query("INSERT INTO resep_dokter VALUES ('{$dtonhand['0']}', '{$_POST['kode_obat']}', '{$_POST['jumlah']}', '{$_POST['aturan_pakai_lainnya']}')");
                }
                redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
              } else {
                  $insert = query("INSERT INTO resep_obat VALUES ('{$next_no_resep}', '{$date}', '{$time}', '{$no_rawat}', '{$_SESSION['username']}', '{$date}', '{$time}', '{$status_lanjut}')");
                  if ($_POST['aturan_pakai_lainnya'] == "") {
                    $insert2 = query("INSERT INTO resep_dokter VALUES ('{$next_no_resep}', '{$_POST['kode_obat']}', '{$_POST['jumlah']}', '{$_POST['aturan_pakai']}')");
                  } else {
                    $insert2 = query("INSERT INTO resep_dokter VALUES ('{$next_no_resep}', '{$_POST['kode_obat']}', '{$_POST['jumlah']}', '{$_POST['aturan_pakai_lainnya']}')");
                  }
                  redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}#resep");
              }
          }
      }
  }
?>

<?php
if (isset($_POST['ok_copyresep'])) {
      $get_number = fetch_array(query("select ifnull(MAX(CONVERT(RIGHT(no_resep,4),signed)),0) from resep_obat where tgl_perawatan like '%{$date}%'"));
      $lastNumber = substr($get_number[0], 0, 4);
      $_next_no_resep = sprintf('%04s', ($lastNumber + 1));
      $tgl_resep = date('Ym');
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
            redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}#resep");
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
    <dt>Nama Obat</dt>
    <dd><select name="kode_obat" class="kd_obat" style="width:100%"></select></dd><br>
    <dt>Jumlah Obat</dt>
    <dd><input class="form-control" name="jumlah" value="10" style="width:100%"></dd><br>
    <dt>Aturan Pakai</dt>
    <dd>
        <select name="aturan_pakai" class="aturan_pakai" id="lainnya" style="width:100%">
        <?php
        $sql = query("SELECT aturan FROM master_aturan_pakai");
        while($row = fetch_array($sql)){
            echo '<option value="'.$row[0].'">'.$row[0].'</option>';
        }
        ?>
        <option value="lainnya">Lainnya</option>
        </select>
    </dd><br>
    <div id="row_dim">
    <dt></dt>
    <dd><input class="form-control" name="aturan_pakai_lainnya" style="width:100%"></dd><br>
    </div>
    <dt></dt>
    <dd><button type="submit" name="ok_obat" value="ok_obat" class="btn bg-indigo waves-effect" onclick="this.value=\'ok_obat\'">OK</button></dd><br>
    <dt></dt>
</dl>
</form>
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
<h4>Riwayat Peresepan</h4>
<?php
//$sql_resep = query("SELECT c.no_rawat, a.kode_brng, a.jml, a.aturan_pakai, b.nama_brng, a.no_resep, c.tgl_peresepan, c.jam_peresepan FROM resep_dokter a, databarang b, resep_obat c, reg_periksa d WHERE a.kode_brng = b.kode_brng AND a.no_resep = c.no_resep AND d.no_rkm_medis = '$no_rkm_medis' AND d.no_rawat = c.no_rawat AND c.kd_dokter = '{$_SESSION['username']}'");
$sql_resep = query("SELECT resep_obat.no_resep, resep_obat.tgl_peresepan FROM reg_periksa, resep_obat WHERE reg_periksa.no_rkm_medis = '$no_rkm_medis' AND reg_periksa.no_rawat = resep_obat.no_rawat AND resep_obat.kd_dokter = '{$_SESSION['username']}'");
?>
<div class="table-responsive">
 <table class="table table-striped">
    <thead>
        <tr>
            <th>Nomor Resep</th>
            <th>Tanggal/Jam</th>
            <th>Detail Resep</th>
            <th>Aksi</th>
        </tr>
    </thead>
    <tbody>
<?php
while ($row = fetch_array($sql_resep)) {
  $sql_obat = query("SELECT databarang.nama_brng, resep_dokter.jml, resep_dokter.aturan_pakai FROM resep_dokter, databarang WHERE resep_dokter.no_resep = '$row[0]' AND resep_dokter.kode_brng = databarang.kode_brng");
  if(num_rows($sql_obat) > 0) {
?>
<tr>
    <td><?php echo $row['0']; ?></td>
    <td><?php echo $row['1']; ?></td>
    <td>
      <ul>
      <?php
      while ($row2 = fetch_array($sql_obat)) {
        echo "<li>".$row2['0']." - ".$row2['1']." - [".$row2['2']."]</li>";
      }
      ?>
      </ul>
    </td>
    <td><a href="<?php echo $_SERVER['PHP_SELF']; ?>?action=view&no_rawat=<?php echo $no_rawat;?>&copyresep=<?php echo $row['0']; ?>#resep" class="btn btn-primary">Copy Resep</a></td>
</tr>
<?php
  }
}
?>
    </tbody>
  </table>
</div>
<?php } ?>
