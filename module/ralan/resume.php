<form method="post">
  <?php
  if(isset($_POST['ok_resume'])){
    if(($no_rawat <> "")){
      $insert = query("INSERT INTO resume_pasien VALUES ('{$no_rawat}','{$_SESSION['username']}','{$_POST['keluhan_utama']}','-','','','{$_POST['diagnosa_utama']}','','','',
                      '','','','','','','{$_POST['prosedur_utama']}','','','','','','','','Hidup','{$_POST['obat_pulang']}')");
           redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
     }
    }
  $keluhan_utama = fetch_assoc(query("SELECT keluhan FROM pemeriksaan_ralan WHERE no_rawat = '{$no_rawat}'"));
  $diagnosa_utama = fetch_assoc(query("SELECT penyakit.nm_penyakit FROM diagnosa_pasien, penyakit WHERE diagnosa_pasien.no_rawat = '{$no_rawat}' AND diagnosa_pasien.status = 'Ralan' AND diagnosa_pasien.prioritas = '1' AND diagnosa_pasien.kd_penyakit = penyakit.kd_penyakit"));
  $prosedur_utama = fetch_assoc(query("SELECT icd9.deskripsi_panjang FROM prosedur_pasien, icd9 WHERE prosedur_pasien.no_rawat = '{$no_rawat}' AND prosedur_pasien.status = 'Ralan' AND prosedur_pasien.prioritas = '1' AND prosedur_pasien.kode = icd9.kode"));
  $terapi = fetch_assoc(query("SELECT GROUP_CONCAT(DISTINCT databarang.nama_brng SEPARATOR '\r\n') AS nama_brng FROM detail_pemberian_obat, databarang WHERE detail_pemberian_obat.no_rawat = '{$no_rawat}' AND detail_pemberian_obat.status = 'Ralan' AND detail_pemberian_obat.kode_brng = databarang.kode_brng"));
  ?>
<div class="row clearfix">
  <div class="col-md-12">
    <div class="form-group">
      <div class="form-line">
        <dt>Keluhan Utama</dt>
        <dd><textarea rows="4" name="keluhan_utama" class="form-control"><?php echo $keluhan_utama['keluhan']; ?></textarea></dd>
      </div>
    </div>
  </div>
</div>
<div class="row clearfix">
  <div class="col-md-12">
    <div class="form-group">
      <div class="form-line">
        <dt>Diagnosa Utama</dt>
        <dd><input type="text" class="form-control" name="diagnosa_utama" value="<?php echo $diagnosa_utama['nm_penyakit']; ?>"></dd>
      </div>
    </div>
  </div>
</div>
<div class="row clearfix">
  <div class="col-md-12">
    <div class="form-group">
      <div class="form-line">
        <dt>Prosedur Utama</dt>
        <dd><input type="text" class="form-control" name="prosedur_utama" value="<?php echo $prosedur_utama['deskripsi_panjang']; ?>"></dd>
      </div>
    </div>
  </div>
</div>
<div class="row clearfix">
  <div class="col-md-12">
    <div class="form-group">
      <div class="form-line">
        <dt>Terapi</dt>
        <dd><textarea rows="4" name="obat_pulang" class="form-control"><?php echo $terapi['nama_brng']; ?></textarea></dd>
      </div>
    </div>
  </div>
</div>

<div class="row clearfix">
  <div class="col-md-3">
    <div class="form-group">
      <dd><button type="submit" name="ok_resume" value="ok_resume" class="btn bg-primary waves-effect" onclick="this.value=\'ok_resume\'">SIMPAN</button></dd><br/>
    </div>
  </div>
</div>
<div class="row clearfix">
  <table id="resume" class="table responsive striped">
     <tr>
      <th>No</th>
      <th>Diagnosa Utama</th>
      <th>Prosedur Utama</th>
      <th>Terapi / Catatan Dokter</th>
      <th>Hapus</th>
    </tr>
    <?php
    $query = query("SELECT keluhan_utama, diagnosa_utama, prosedur_utama, obat_pulang FROM resume_pasien where no_rawat = '{$no_rawat}'");
    $no=1;
     while ($data = fetch_array($query)) {
    ?>
    <tr>
      <td><?php echo $no; ?></td>
      <td><?php echo $data['0']; ?></td>
      <td><?php echo $data['1']; ?></td>
      <td><?php echo $data['2']; ?></td>
      <td><?php echo $data['3']; ?></td>
      <td><a class="btn btn-danger btn-xs" href="<?php $_SERVER['PHP_SELF']; ?>?action=delete_resume&no_rawat=<?php echo $no_rawat; ?>">[X]</a></td>
    </tr>
    <?php
      $no++;}
    ?>
  </table>
</div>
</form>
