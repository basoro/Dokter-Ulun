<form method="post">
  <?php
  if (isset($_POST['ok_prosedur'])) {
    if (($_POST['kode_prosedur'] <> "") and ($no_rawat <> "")) {

      $cek_prioritas_prosedur = fetch_assoc(query("SELECT prioritas FROM prosedur_pasien WHERE kode = '".$_POST['kode_prosedur']."' AND no_rawat = '$no_rawat'"));
      $cek_prioritas_primer = fetch_assoc(query("SELECT prioritas FROM prosedur_pasien WHERE prioritas = '1' AND no_rawat = '$no_rawat'"));
      $cek_prioritas = fetch_assoc(query("SELECT prioritas FROM prosedur_pasien WHERE prioritas = '".$_POST['prioritas']."' AND no_rawat = '$no_rawat'"));

      if (!empty($cek_prioritas_prosedur)) {
          $errors[] = 'Sudah ada prioritas prosedur yang sama.';
      }

      if(!empty($errors)) {

          foreach($errors as $error) {
              echo validation_errors($error);
          }

      } else {

           $insert = query("INSERT INTO prosedur_pasien VALUES ('{$no_rawat}', '{$_POST['kode_prosedur']}', 'Ralan', '{$_POST['prioritas']}')");
           if ($insert) {
                redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
           }
      }
    }
  }
  if (isset($_POST['ok_perawatan'])) {
    if (($_POST['kode_perawatan'] <> "") and ($no_rawat <> "")) { 

           $cek_tarif = fetch_assoc(query("SELECT tarif_tindakandr, total_byrdr FROM jns_perawatan WHERE kd_jenis_prw = '".$_POST['kode_perawatan']."'"));
      	

           $insert = query("INSERT INTO rawat_jl_dr VALUES ('{$no_rawat}', '{$_POST['kode_perawatan']}', '{$_SESSION['username']}', CURRENT_DATE(), CURRENT_TIME(), '0', '0', '{$cek_tarif['tarif_tindakandr']}', '0', '0', '{$cek_tarif['total_byrdr']}', 'Belum')");
           if ($insert) {
                redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
           }
    }
  }

  ?>
<dl class="dl-horizontal">
  <dt>Prosedur (ICD9)</dt>
    <dd><select name="kode_prosedur" class="kd_prosedur" style="width:100%"></select></dd><br/>
  <dt>Prioritas</dt>
    <dd>
      <select name="prioritas" class="prioritas" style="width:100%">
        <option value="1">Prosedur Ke-1</option>
        <option value="2">Prosedur Ke-2</option>
        <option value="3">Prosedur Ke-3</option>
        <option value="4">Prosedur Ke-4</option>
        <option value="5">Prosedur Ke-5</option>
        <option value="6">Prosedur Ke-6</option>
        <option value="7">Prosedur Ke-7</option>
        <option value="8">Prosedur Ke-8</option>
        <option value="9">Prosedur Ke-9</option>
        <option value="10">Prosedur Ke-10</option>
      </select>
    </dd><br/>
  <dt></dt>
    <dd><button type="submit" name="ok_prosedur" value="ok_prosedur" class="btn bg-indigo waves-effect" onclick="this.value=\'ok_prosedur\'">SIMPAN</button></dd><br/>
  <dt></dt>
    <dd>
      <ul style="list-style:none;margin-left:0;padding-left:0;">
        <?php
        $query = query("SELECT a.kode, b.deskripsi_pendek, a.prioritas FROM prosedur_pasien a, icd9 b, reg_periksa c WHERE a.kode = b.kode AND a.no_rawat = '{$no_rawat}' AND a.no_rawat = c.no_rawat ORDER BY a.prioritas ASC");
          $no=1;
        while ($data = fetch_array($query)) {
        ?>
                  <li><?php echo $no; ?>. <?php echo $data['0']; ?> - <?php echo $data['1']; ?> <a class="btn btn-danger btn-xs" href="<?php $_SERVER['PHP_SELF']; ?>?action=delete_prosedur&kode=<?php echo $data['0']; ?>&prioritas=<?php echo $data['2']; ?>&no_rawat=<?php echo $no_rawat; ?>">[X]</a></li>
        <?php
              $no++;
        }
        ?>
      </ul>
    </dd>
</dl>
<dl class="dl-horizontal">
  <dt>Jenis Tindakan</dt>
    <dd><select name="kode_perawatan" class="kd_perawatan" style="width:100%"></select></dd><br/>
  <dt></dt>
    <dd><button type="submit" name="ok_perawatan" value="ok_perawatan" class="btn bg-indigo waves-effect" onclick="this.value=\'ok_perawatan\'">SIMPAN</button></dd><br/>
  <dt></dt>
    <dd>
      <ul style="list-style:none;margin-left:0;padding-left:0;">
        <?php
        $query = query("SELECT a.kd_jenis_prw, b.nm_perawatan FROM rawat_jl_dr a, jns_perawatan b, reg_periksa c WHERE a.kd_jenis_prw = b.kd_jenis_prw AND a.no_rawat = '{$no_rawat}' AND a.no_rawat = c.no_rawat");
          $no=1;
        while ($data = fetch_array($query)) {
        ?>
                  <li><?php echo $no; ?>. <?php echo $data['0']; ?> - <?php echo $data['1']; ?> <a class="btn btn-danger btn-xs" href="<?php $_SERVER['PHP_SELF']; ?>?action=delete_perawatan&kode=<?php echo $data['0']; ?>&prioritas=<?php echo $data['2']; ?>&no_rawat=<?php echo $no_rawat; ?>">[X]</a></li>
        <?php
              $no++;
        }
        ?>
      </ul>
    </dd>
</dl>
</form>
