<?php
if(isset($_POST['ok_an'])){
  if(($no_rawat <> "")){
    $insert = query("INSERT INTO pemeriksaan_ralan VALUE ('{$no_rawat}','{$date}','{$time}','{$_POST['suhu']}','{$_POST['tensi']}','{$_POST['nadi']}','{$_POST['respirasi']}','{$_POST['tinggi']}','{$_POST['berat']}'
                ,'{$_POST['gcs']}','{$_POST['keluhan']}','{$_POST['pemeriksaan']}','{$_POST['alergi']}','-','{$_POST['tndklnjt']}')");
    if($insert){
      redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
    }
  }
}
if(isset($_POST['edit_an'])){
  if(($no_rawat <> "")){
    //$insert = query("UPDATE pemeriksaan_ralan SET suhu_tubuh = $_POST['suhu'], tensi = $_POST['tensi'], nadi = $_POST['nadi'], respirasi = $_POST['respirasi'], tinggi = $_POST['tinggi'], berat = $_POST['berat'], gcs = $_POST['gcs'], keluhan = $_POST['keluhan'], pemeriksaan = $_POST['pemeriksaan'], alergi = $_POST['alergi'], rtl = $_POST['tndklnjt'] WHERE no_rawat = $no_rawat");
	$insert = query("UPDATE pemeriksaan_ralan SET suhu_tubuh = '{$_POST['suhu']}', tensi = '{$_POST['tensi']}', nadi = '{$_POST['nadi']}', respirasi = '{$_POST['respirasi']}', tinggi = '{$_POST['tinggi']}', berat = '{$_POST['berat']}', gcs = '{$_POST['gcs']}', keluhan = '{$_POST['keluhan']}', pemeriksaan = '{$_POST['pemeriksaan']}', alergi = '{$_POST['alergi']}', rtl = '{$_POST['tndklnjt']}' WHERE no_rawat = '{$no_rawat}'");

    if($insert){
      redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
    }
  }
}

?>

<?php $opt = isset($_GET['opt'])?$_GET['opt']:null; ?>
<?php if(!$opt) { ?>
<form method="post">
<div class="row clearfix">
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Keluhan</dt>
      <dd><textarea rows="4" name="keluhan" class="form-control"></textarea></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Pemeriksaan</dt>
      <dd><textarea rows="4" name="pemeriksaan" class="form-control"></textarea></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Alergi</dt>
      <dd><input type="text" class="form-control" name="alergi"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Tindak Lanjut</dt>
      <dd><input type="text" class="form-control" name="tndklnjt"></dd>
    </div>
  </div>
</div>
</div>
<div class="row clearfix">
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Suhu Badan (C)</dt>
      <dd><input type="text" class="form-control" name="suhu"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Tinggi Badan (Cm)</dt>
      <dd><input type="text" class="form-control" name="tinggi"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Tensi</dt>
      <dd><input type="text" class="form-control" name="tensi"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Respirasi (per Menit)</dt>
      <dd><input type="text" class="form-control" name="respirasi"></dd>
    </div>
  </div>
</div>
</div>
<div class="row clearfix">
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Berat (Kg)</dt>
      <dd><input type="text" class="form-control" name="berat"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Nadi (per Menit)</dt>
      <dd><input type="text" class="form-control" name="nadi"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Imun Ke</dt>
      <dd><input type="text" class="form-control" name="imun"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>GCS(E , V , M)</dt>
      <dd><input type="text" class="form-control" name="gcs"></dd>
    </div>
  </div>
</div>
</div>
<div class="row clearfix">
<div class="col-md-3">
  <div class="form-group">
    <dd><button type="submit" name="ok_an" value="ok_an" class="btn bg-indigo waves-effect" onclick="this.value=\'ok_an\'">SIMPAN</button></dd><br/>
  </div>
</div>
</div>
<div class="row clearfix">
  <table id="keluhan" class="table striped">
    <tr>
      <th>No</th>
      <th>Keluhan</th>
      <th>Pemeriksaan</th>
      <th>Suhu</th>
      <th>BB</th>
      <th>Tinggi</th>
      <th>Tensi</th>
      <th>Nadi</th>
      <th>RR</th>
      <th>Action</th>
    </tr>
    <?php
    $query = query("SELECT * FROM pemeriksaan_ralan WHERE no_rawat = '{$no_rawat}'");
    $no=1;
     while ($data = fetch_array($query)) {
    ?>
    <tr>
      <td><?php echo $no; ?></td>
      <td><?php echo $data['keluhan']; ?></td>
      <td><?php echo $data['pemeriksaan']; ?></td>
      <td><?php echo $data['suhu_tubuh']; ?></td>
      <td><?php echo $data['berat']; ?></td>
      <td><?php echo $data['tinggi']; ?></td>
      <td><?php echo $data['tensi']; ?></td>
      <td><?php echo $data['nadi']; ?></td>
      <td><?php echo $data['respirasi']; ?></td>
      <td><a class="btn btn-danger btn-xs" href="<?php $_SERVER['PHP_SELF']; ?>?action=delete_an&no_rawat=<?php echo $no_rawat; ?>">[Hapus]</a> &nbsp; <a class="btn btn-danger btn-xs" href="<?php $_SERVER['PHP_SELF']; ?>?action=view&no_rawat=<?php echo $no_rawat; ?>&opt=edit_anamnese#anamnese">[Edit]</a></td>
    </tr>
    <?php
      $no++;}
    ?>
  </table>
</div>
</form>
<?php } ?>

<?php if($opt == 'edit_anamnese' ) { ?> 
<?php
    $row = fetch_assoc(query("SELECT * FROM pemeriksaan_ralan WHERE no_rawat = '{$no_rawat}'"));
?>                           
<form method="post">
<div class="row clearfix">
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Edit Keluhan</dt>
      <dd><textarea rows="4" name="keluhan" class="form-control"><?php echo $row['keluhan']; ?></textarea></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Pemeriksaan</dt>
      <dd><textarea rows="4" name="pemeriksaan" class="form-control"><?php echo $row['pemeriksaan']; ?></textarea></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Alergi</dt>
      <dd><input type="text" class="form-control" value="<?php echo $row['alergi']; ?>" name="alergi"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Tindak Lanjut</dt>
      <dd><input type="text" class="form-control" value="<?php echo $row['rtl']; ?>" name="tndklnjt"></dd>
    </div>
  </div>
</div>
</div>
<div class="row clearfix">
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Suhu Badan (C)</dt>
      <dd><input type="text" class="form-control" value="<?php echo $row['suhu_tubuh']; ?>" name="suhu"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Tinggi Badan (Cm)</dt>
      <dd><input type="text" class="form-control" value="<?php echo $row['tinggi']; ?>" name="tinggi"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Tensi</dt>
      <dd><input type="text" class="form-control" value="<?php echo $row['tensi']; ?>" name="tensi"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Respirasi (per Menit)</dt>
      <dd><input type="text" class="form-control" value="<?php echo $row['respirasi']; ?>" name="respirasi"></dd>
    </div>
  </div>
</div>
</div>
<div class="row clearfix">
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Berat (Kg)</dt>
      <dd><input type="text" class="form-control" value="<?php echo $row['berat']; ?>" name="berat"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Nadi (per Menit)</dt>
      <dd><input type="text" class="form-control" value="<?php echo $row['nadi']; ?>" name="nadi"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>Imun Ke</dt>
      <dd><input type="text" class="form-control" value="<?php echo $row['imun_ke']; ?>"  name="imun"></dd>
    </div>
  </div>
</div>
<div class="col-md-3">
  <div class="form-group">
    <div class="form-line">
      <dt>GCS(E , V , M)</dt>
      <dd><input type="text" class="form-control" value="<?php echo $row['gcs']; ?>" name="gcs"></dd>
    </div>
  </div>
</div>
</div>
<div class="row clearfix">
<div class="col-md-3">
  <div class="form-group">
    <dd><button type="submit" name="edit_an" value="edit_an" class="btn bg-indigo waves-effect" onclick="this.value=\'edit_an\'">SIMPAN</button></dd><br/>
  </div>
</div>
</div>
</form>
<?php } ?>
