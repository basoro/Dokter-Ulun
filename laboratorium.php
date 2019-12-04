<?php

include_once ('layout/header.php');

if(isset($_GET['no_rawat'])) {
    $_sql = "SELECT a.no_rkm_medis, a.no_rawat, b.nm_pasien, b.umur, a.status_lanjut , a.kd_pj, GROUP_CONCAT(DISTINCT d.nm_perawatan SEPARATOR '<br>') AS nm_perawatan FROM reg_periksa a, pasien b, periksa_lab c, jns_perawatan_lab d WHERE a.no_rkm_medis = b.no_rkm_medis AND a.no_rawat = '$_GET[no_rawat]' AND a.no_rawat = c.no_rawat AND c.kd_jenis_prw = d.kd_jenis_prw GROUP BY a.no_rawat";
    $found_pasien = query($_sql);
    if(num_rows($found_pasien) == 1) {
	     while($row = fetch_array($found_pasien)) {
	        $no_rkm_medis  = $row['0'];
	        $get_no_rawat  = $row['1'];
            $no_rawat	   = $row['1'];
	        $nm_pasien     = $row['2'];
	        $umur          = $row['3'];
            $status_lanjut = $row['4'];
            $kd_pj         = $row['5'];
            $nm_perawatan  = $row['6'];
	     }
    } else {
	redirect ("{$_SERVER['PHP_SELF']}");
    }
}
?>
<section class="content">
  <div class="container-fluid">
    <?php $action = isset($_GET['action'])?$_GET['action']:null; ?>
    <?php if(!$action){  ?>
      <!-- Menu Utama -->
      <div class="row">
        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
          <div class="card">
            <div class="header">
              <h2>
                PASIEN LABORATORIUM
                <small>Tanggal : <?php if(isset($_POST['tanggal']) && $_POST['tanggal'] !="") { echo $_POST['tanggal']; } else { echo $date; } ?></small>
              </h2>
            </div>
            <div class="table-responsive">

              <div class="body">
                <!--tab utama -->
                <div class="tab-content m-t-20">
                  <div role="tabpanel" class="tab-pane fade in active" id="poli">
                    <table id="datatable_ralan" class="table table-bordered table-striped table-hover display nowrap">
                      <thead>
                        <tr>
                          <th>Nama Pasien</th>
                          <th>No RM</th>
                          <th>Dokter Pengirim</th>
                          <th>No. Antrian</th>
                          <th>Pemeriksaan</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <?php
                          $_sql = "SELECT b.nm_pasien, c.nm_dokter, a.no_reg, a.no_rkm_medis, a.no_rawat, a.stts, GROUP_CONCAT(DISTINCT e.nm_perawatan SEPARATOR '<br>') AS nm_perawatan FROM reg_periksa a, pasien b, dokter c, periksa_lab d, jns_perawatan_lab e WHERE a.no_rkm_medis = b.no_rkm_medis AND a.no_rawat = d.no_rawat AND d.kd_jenis_prw = e.kd_jenis_prw ";
                            if(isset($_POST['tanggal']) && $_POST['tanggal'] !="") {
                                $_sql .= " AND a.tgl_registrasi = '{$_POST['tanggal']}'";
                            } else {
                                $_sql .= " AND a.tgl_registrasi = '$date'";
                            }
                            $_sql .= "  GROUP BY a.no_rawat";

                            $sql = query($_sql);
                            $no = 1;
                            while($row = fetch_array($sql)){
                              echo '<tr>';
                              echo '<td>';
                              echo '<a href="'.$_SERVER['PHP_SELF'].'?action=view&no_rawat='.$row['4'].'" class="title">'.ucwords(strtolower(SUBSTR($row['0'], 0, 20))).' ...</a>';
                              echo '</td>';
                              echo '<td>'.$row['3'].'</td>';
                              echo '<td>'.$row['1'].'</td>';
                              echo '<td>'.$row['2'].'</td>';
                              echo '<td>'.$row['6'].'</td>';
                              echo '<td>'.$row['5'].'</td>';
                              echo '</tr>';
                            $no++;
                          }
                        ?>
                      </tbody>
                    </table>
                  </div>
                  <div role="tabpanel" class="tab-pane fade in" id="intern">
                    <?php include_once ('intern.php');?>
                  </div>
                </div>
                <!--tab utama -->
                <div class="body">
                  <form method="POST" action="">
                    <div class="row clearfix">
                      <div class="col-xs-8 col-lg-10">
                        <div class="form-group">
                          <div class="form-line">
                            <input type="text" class="datepicker form-control" name="tanggal" placeholder="Pilih tanggal...">
                          </div>
                        </div>
                      </div>
                      <div class="col-xs-4 col-lg-2">
                        <input type="submit" class="btn btn-primary btn-lg m-l-15 waves-effect" value="Submit">
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Menu Utama -->
    <?php } ?>
    <?php if($action == "view"){ ?>
    <!-- Menu View -->
      <div class="row clearfix">
        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
          <div class="card">
            <div class="header">
              <h2>Detail Pasien</h2>
            </div>
            <div class="body">
              <dl class="dl-horizontal">
                <dt>Nama Lengkap</dt>
                <dd><?php echo $nm_pasien; ?></dd>
                <dt>No. RM</dt>
                <dd><?php echo $no_rkm_medis; ?></dd>
                <dt>No. Rawat</dt>
                <dd><?php echo $no_rawat; ?></dd>
                <dt>Umur</dt>
                <dd><?php echo $umur; ?></dd>
                <dt>Pemeriksaan</dt>
                <dd><?php echo $nm_perawatan; ?></dd>
              </dl>
            </div>
            <div class="body">
              <dt>Image Laboratorium</dt>
              <dd>
              <div id="aniimated-thumbnials" class="list-unstyled row clearfix">
                <?php
                $sql = query("select * from berkas_digital_perawatan where kode = '005' and no_rawat= '{$_GET['no_rawat']}'");
                $no=1;
                while ($row = fetch_array($sql)) {
                  echo '<div class="col-lg-3 col-md-6 col-sm-12 col-xs-12">';
                  echo '<a href="'.SIMRSURL.'/berkasrawat/'.$row[2].'" data-sub-html=""><img class="img-responsive thumbnail"  src="'.SIMRSURL.'/berkasrawat/'.$row[2].'"></a>';
                  echo '</div>';
                  $no++;
                }
                ?>
              </div>
              </dd>
            </div>

            <div class="body">
			  <dt>Hasil Pemeriksaan</dt><br>
              <dd>
                <ul style="list-style:none;">
                  <?php
                    $sql_lab = query("select template_laboratorium.Pemeriksaan, detail_periksa_lab.nilai, template_laboratorium.satuan, detail_periksa_lab.nilai_rujukan, detail_periksa_lab.keterangan from detail_periksa_lab inner join  template_laboratorium on detail_periksa_lab.id_template=template_laboratorium.id_template  where detail_periksa_lab.no_rawat= '{$_GET['no_rawat']}'");
                    $no=1;
                    while ($row_lab = fetch_array($sql_lab)) {
                      echo '<li>'.$no.'. '.$row_lab[0].' ('.$row_lab[3].') = '.$row_lab[1].' '.$row_lab[2].'</li>';
                      $no++;
                    }
                  ?>
                </ul>

              </dd>
            </div>
            <div class="body">
                <?php
                $sql = fetch_assoc(query("select * from saran_kesan_lab where no_rawat= '{$_GET['no_rawat']}'"));
                ?>
			  <dt>Kesan</dt>
              <dd>
                <?php
                echo nl2br($sql['kesan']);
                ?>
              </dd>
              <br>
			  <dt>Saran</dt>
              <dd>
                <?php
                echo nl2br($sql['saran']);
                ?>
              </dd>
            </div>
              <div class="body">
              <?php
              if (isset($_POST['ok_hasil'])) {
                if (($_POST['saran'] <> "") and ($no_rawat <> "")) {

                       $insert2 = query("INSERT INTO saran_kesan_lab VALUES ('{$no_rawat}', CURRENT_DATE(), CURRENT_TIME(), '{$_POST['saran']}','{$_POST['kesan']}')");
                       if ($insert) {

                            redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
                       }
                }
              }
              ?>
                <form method="POST" action="">
                  <dt>Kesan</dt><br>
                  <dd><textarea rows="2" name="kesan" class="form-control no-resize" placeholder="Tulis kesan disini..."></textarea></dd><br>
                  <dt>Saran</dt><br>
                  <dd><textarea rows="2" name="saran" class="form-control no-resize" placeholder="Tulis saran disini..."></textarea></dd><br>
                  <dt></dt>
                  <dd><button type="submit" name="ok_hasil" value="ok_hasil" class="btn bg-indigo waves-effect" onclick="this.value=\'ok_hasil\'">SIMPAN</button></dd><br>
                  <dt></dt>
                </form>
              </div>
          </div>
        </div>
      </div>
    <!-- Menu View -->
    <?php } ?>
  </div>
</section>
<?php include_once ('layout/footer.php'); ?>
