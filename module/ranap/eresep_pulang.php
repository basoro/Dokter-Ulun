<form method="post">
  <?php
  if (isset($_POST['ok_obatpulang'])) {
    if (($_POST['kode_obat'] <> "") and ($no_rawat <> "")) {
      $get_obat = fetch_assoc(query("SELECT* FROM databarang WHERE kode_brng = '{$_POST['kode_obat']}'"));
      $total = $get_obat['kelas3'] * $_POST['jumlah'];

      if ($_POST['aturan_pakai_lainnya'] == "") {
        $aturan_pakai = $_POST['aturan_pakai'];
      } else {
        $aturan_pakai = $_POST['aturan_pakai_lainnya'];
      }

      $get_bangsal = fetch_assoc(query("SELECT bangsal.kd_bangsal FROM kamar_inap, reg_periksa, bangsal, kamar, dpjp_ranap WHERE reg_periksa.no_rawat = '{$no_rawat}' AND kamar_inap.no_rawat = reg_periksa.no_rawat AND kamar_inap.kd_kamar = kamar.kd_kamar AND kamar.kd_bangsal = bangsal.kd_bangsal AND dpjp_ranap.no_rawat = reg_periksa.no_rawat AND dpjp_ranap.kd_dokter = '{$_SESSION['username']}'"));
      $get_obatmaxtgl = fetch_assoc(query("SELECT MAX(tanggal) AS tanggal FROM riwayat_barang_medis WHERE kode_brng = '{$_POST['kode_obat']}' AND kd_bangsal = 'B0001'"));
      $get_obatmaxjam = fetch_assoc(query("SELECT MAX(jam) AS jam FROM riwayat_barang_medis WHERE kode_brng = '{$_POST['kode_obat']}' AND tanggal = '{$get_obatmaxtgl['tanggal']}' AND kd_bangsal = 'B0001'"));
      $get_obatstok = fetch_assoc(query("SELECT * FROM riwayat_barang_medis WHERE kode_brng = '{$_POST['kode_obat']}' AND tanggal = '{$get_obatmaxtgl['tanggal']}' AND jam = '{$get_obatmaxjam['jam']}' AND kd_bangsal = 'B0001'"));
      $stokakhir = $get_obatstok['stok_akhir'] - $_POST['jumlah'];

      if($get_obatstok['stok_akhir'] < 10 ) {
        $errors[] = 'Maah stok obat di depo rawat inap tidak mencukupi';
      }

      if(!empty($errors)) {
        foreach($errors as $error) {
          echo validation_errors($error);
        }
      } else {
        $insert = query("INSERT INTO resep_pulang VALUES ('{$no_rawat}', '{$_POST['kode_obat']}', '{$_POST['jumlah']}', '{$get_obat['kelas3']}', '{$total}', '{$aturan_pakai}', CURRENT_DATE(), CURRENT_TIME(), '{$get_bangsal['kd_bangsal']}', '{$get_obatstok['no_batch']}', '{$get_obatstok['no_faktur']}')");
        if($insert) {
          $insert1 = query("INSERT INTO riwayat_barang_medis VALUES ('{$_POST['kode_obat']}', '{$get_obatstok['stok_akhir']}', '0', '{$_POST['jumlah']}', '{$stokakhir}', 'Resep Pulang', CURRENT_DATE(), CURRENT_TIME(), '{$_SESSION['username']}', '{$get_bangsal['kd_bangsal']}', 'Simpan', '{$get_obatstok['no_batch']}', '{$get_obatstok['no_faktur']}')");
          $insert2 = query("INSERT INTO gudangbarang VALUES ('{$_POST['kode_obat']}', '{$get_bangsal['kd_bangsal']}', '{$stokakhir}', '-', '-')");
        }
      }
    }
  }
 ?>
  <dl class="dl-horizontal">
    <dt>Nama Obat Pulang</dt>
    <dd><select name="kode_obat" class="kd_obat" style="width:100%"></select></dd><br>
    <dt>Jumlah Obat Pulang</dt>
    <dd><input class="form-control" name="jumlah" value="10" style="width:100%"></dd><br>
    <dt>Aturan Pakai</dt>
    <dd>
      <select name="aturan_pakai" class="aturan_pakai" id="lainnya_pulang" style="width:100%">
        <?php
        $sql = query("SELECT aturan FROM master_aturan_pakai");
        while($row = fetch_array($sql)){
          echo '<option value="'.$row[0].'">'.$row[0].'</option>';
        }
        ?>
        <option value="lainnya">Lainnya</option>
      </select>
    </dd><br>
    <div id="row_dim_pulang">
      <dt></dt>
      <dd><input class="form-control" name="aturan_pakai_lainnya" style="width:100%"></dd><br>
    </div>

    <dt></dt>
    <dd><button type="submit" name="ok_obatpulang" value="ok_obatpulang" class="btn bg-indigo waves-effect" onclick="this.value=\'ok_obatpulang\'">SIMPAN</button></dd><br>
    <dt></dt>
  </dl>
  <div class="table-responsive">
    <table class="table table-striped">
      <thead>
        <tr>
          <th>Nama Obat</th>
          <th>Jumlah</th>
          <th>Aturan Pakai</th>
        </tr>
      </thead>
      <tbody>
        <?php
        $query_resep = query("SELECT b.nama_brng, a.jml_barang, a.dosis, b.kode_brng FROM resep_pulang a, databarang b WHERE a.no_rawat = '{$no_rawat}' AND a.kode_brng = b.kode_brng ORDER BY a.jam DESC");
        while ($data_resep = fetch_array($query_resep)) {
        ?>
        <tr>
          <td><?php echo $data_resep['0']; ?> <a class="btn btn-danger btn-xs" href="<?php $_SERVER['PHP_SELF']; ?>?action=delete_obat_pulang&kode_obat=<?php echo $data_resep['3']; ?>&no_rawat=<?php echo $no_rawat; ?>">[X]</a></td>
          <td><?php echo $data_resep['1']; ?></td>
          <td><?php echo $data_resep['2']; ?></td>
        </tr>
        <?php
        }
        ?>
      </tbody>
    </table>
  </div>
</form>
