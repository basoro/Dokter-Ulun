<?php

include_once ('layout/header.php');

if(isset($_GET['no_rawat'])) {
    $_sql = "SELECT a.no_rkm_medis, a.no_rawat, b.nm_pasien, b.umur, a.status_lanjut , a.kd_pj FROM reg_periksa a, pasien b WHERE a.no_rkm_medis = b.no_rkm_medis AND a.no_rawat = '$_GET[no_rawat]'";
    $found_pasien = query($_sql);
    if(num_rows($found_pasien) == 1) {
	     while($row = fetch_array($found_pasien)) {
	        $no_rkm_medis  = $row['0'];
	        $get_no_rawat	     = $row['1'];
            $no_rawat	     = $row['1'];
	        $nm_pasien     = $row['2'];
	        $umur          = $row['3'];
          $status_lanjut          = $row['4'];
          $kd_pj         = $row['5'];
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
                PASIEN BOOKING OPERASI
                <small>Tanggal : <?php if(isset($_POST['tanggal']) && $_POST['tanggal'] !="") { echo $_POST['tanggal']; } else { echo $date; } ?></small>
              </h2>
            </div>
            <div class="table-responsive">
              <ul class="nav nav-tabs tab-nav-right" role="tablist">
                <li role="presentation" class="active"><a href="#poli" data-toggle="tab">Jadwal Operasi</a></li>
                <!-- <li role="presentation"><a href="#intern" data-toggle="tab">Jadwal Semua Operasi</a></li> -->
              </ul>
              <div class="body">
                <!--tab utama -->
                <div class="tab-content m-t-20">
                  <div role="tabpanel" class="tab-pane fade in active" id="poli">
                    <table id="datatable_ralan" class="table table-bordered table-striped table-hover display nowrap">
                      <thead>
                        <tr>
                          <th>Nama Pasien</th>
                          <th>No RM</th>
                          <th>Nama Operasi</th>
                          <th>Jam Mulai</th>
                          <th>Jam Selesai</th>
                          <th>Diagnosa</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <?php
                          $data = "SELECT b.nm_pasien, a.no_rkm_medis, c.nm_perawatan, d.jam_mulai, d.jam_selesai, e.nm_penyakit, d.status
                          FROM reg_periksa a, pasien b, paket_operasi c, booking_operasi d, penyakit e, diagnosa_pasien f , dokter g
                          WHERE d.kd_dokter = '{$_SESSION['username']}' AND a.no_rkm_medis = b.no_rkm_medis AND d.kode_paket = c.kode_paket
                          AND d.kd_dokter = g.kd_dokter AND a.no_rawat = d.no_rawat AND a.no_rawat = f.no_rawat AND f.kd_penyakit = e.kd_penyakit
                          AND d.kd_dokter = g.kd_dokter";
                          if(isset($_POST['tanggal']) && $_POST['tanggal'] !="") {
                              $data .= " AND d.tanggal = '{$_POST['tanggal']}'";
                          } else {
                              $data .= " AND d.tanggal = '$date'";
                          }
                          $data .= "  ORDER BY a.no_reg ASC";
                            $sql = query($data);
                            $no = 1;
                            while($row = fetch_array($sql)){?>
                            <tr>
                              <td><?php echo $row['nm_pasien'];?></td>
                              <td><?php echo $row['no_rkm_medis'];?></td>
                              <td><?php echo $row['nm_perawatan'];?></td>
                              <td><?php echo $row['jam_mulai'];?></td>
                              <td><?php echo $row['jam_selesai'];?></td>
                              <td><?php echo $row['nm_penyakit'];?></td>
                              <td><?php echo $row['status'];?></td>
                            </tr>
                            <?php
                            $no++;
                            }
                            ?>
                      </tbody>
                    </table>
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
              </dl>
            </div>
            <div class="body">
              <!-- Nav Tabs -->
              <div class="row">
                <ul class="nav nav-tabs tab-nav-right" role="tablist">
                  <li role="presentation" class="active"><a href="#riwayat" data-toggle="tab">RIWAYAT</a></li>
                  <li role="presentation"><a href="#anamnese" data-toggle="tab">PEMERIKSAAN</a></li>
                  <li role="presentation"><a href="#diagnosa" data-toggle="tab">DIAGNOSA</a></li>
                  <li role="presentation"><a href="#resep" data-toggle="tab">RESEP</a></li>
                  <li role="presentation"><a href="#permintaanlab" data-toggle="tab">PERMINTAAN LAB</a></li>
                  <li role="presentation"><a href="#permintaanrad" data-toggle="tab">PERMINTAAN RAD</a></li>
                  <li role="presentation"><a href="#skdp" data-toggle="tab">SURAT KONTROL</a></li>
                </ul>
              </div>
              <!-- End Nav Tabs -->
              <!-- Tab Panes -->
              <div class="tab-content m-t-20">
                <!-- riwayat -->
                <div role="tabpanel" class="tab-pane fade in active" id="riwayat">
                  <table id="riwayatmedis" class="table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Nomor Rawat</th>
                        <th>Klinik/Ruangan/Dokter</th>
                        <th>Keluhan</th>
                        <th>Pemeriksaan</th>
                        <th>Diagnosa</th>
                        <th>Obat</th>
                        <th>Laboratorium</th>
                        <th>Radiologi</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php
                      $q_kunj = query ("SELECT tgl_registrasi, no_rawat, status_lanjut FROM reg_periksa WHERE no_rkm_medis = '$no_rkm_medis' AND stts !='Batal' ORDER BY tgl_registrasi DESC");
                      while ($data_kunj = fetch_array($q_kunj)) {
                          $tanggal_kunj   = $data_kunj[0];
                          $no_rawat_kunj = $data_kunj[1];
                          $status_lanjut_kunj = $data_kunj[2];
                      ?>
                      <tr>
                        <td><?php echo $tanggal_kunj; ?></td>
                        <td><?php echo $no_rawat_kunj; ?></td>
                        <td>
                          <?php
                          if($status_lanjut_kunj == 'Ralan') {
                            $sql_poli = fetch_assoc(query("SELECT a.nm_poli, c.nm_dokter FROM poliklinik a, reg_periksa b, dokter c WHERE b.no_rawat = '$no_rawat_kunj' AND a.kd_poli = b.kd_poli AND b.kd_dokter = c.kd_dokter"));
                            echo $sql_poli['nm_poli'];
                            echo '<br>';
                            echo "(".$sql_poli['nm_dokter'].")";
                          } else {
                            echo 'Rawat Inap';
                          }
                          ?>
                        </td>
                          <?php
                          if($status_lanjut_kunj == 'Ralan') {
                            $sql_riksaralan = fetch_assoc(query("SELECT keluhan, pemeriksaan FROM pemeriksaan_ralan WHERE no_rawat = '$no_rawat_kunj'"));
                            echo "<td>".$sql_riksaralan['keluhan']."</td>";
                            echo "<td>".$sql_riksaralan['pemeriksaan']."</td>";
                          } else {
                            $sql_riksaranap = fetch_assoc(query("SELECT keluhan, pemeriksaan FROM pemeriksaan_ranap WHERE no_rawat = '$no_rawat_kunj'"));
                            echo "<td>".$sql_riksaranap['keluhan']."</td>";
                            echo "<td>".$sql_riksaranap['pemeriksaan']."</td>";
                          }
                          ?>
                        <td>
                            <ul style="list-style:none;">
                            <?php
                            $sql_dx = query("SELECT a.kd_penyakit, a.nm_penyakit FROM penyakit a, diagnosa_pasien b WHERE a.kd_penyakit = b.kd_penyakit AND b.no_rawat = '$no_rawat_kunj'");
                            $no=1;
                            while ($row_dx = fetch_array($sql_dx)) {
                                echo '<li>'.$no.'. '.$row_dx[1].' ('.$row_dx[0].')</li>';
                                $no++;
                            }
                            ?>
                            </ul>
                        </td>
                        <td>
                            <ul style="list-style:none;">
                            <?php
                            $sql_obat = query("select detail_pemberian_obat.jml, databarang.nama_brng from detail_pemberian_obat inner join databarang on detail_pemberian_obat.kode_brng=databarang.kode_brng where detail_pemberian_obat.no_rawat= '$no_rawat_kunj'");
                            $no=1;
                            while ($row_obat = fetch_array($sql_obat)) {
                                echo '<li>'.$no.'. '.$row_obat[1].' ('.$row_obat[0].')</li>';
                                $no++;
                            }
                            ?>
                            </ul>
                        </td>
                        <td>
                            <ul style="list-style:none;">
                            <?php
                            $sql_lab = query("select template_laboratorium.Pemeriksaan, detail_periksa_lab.nilai, template_laboratorium.satuan, detail_periksa_lab.nilai_rujukan, detail_periksa_lab.keterangan from detail_periksa_lab inner join  template_laboratorium on detail_periksa_lab.id_template=template_laboratorium.id_template  where detail_periksa_lab.no_rawat= '$no_rawat_kunj'");
                            $no=1;
                            while ($row_lab = fetch_array($sql_lab)) {
                                echo '<li>'.$no.'. '.$row_lab[0].' ('.$row_lab[3].') = '.$row_lab[1].' '.$row_lab[2].'</li>';
                                $no++;
                            }
                            ?>
                            </ul>
                        </td>
                        <td>
                            <div id="aniimated-thumbnials" class="list-unstyled row clearfix">
                            <?php
                            $sql_rad = query("select * from gambar_radiologi where no_rawat= '$no_rawat_kunj'");
                            $no=1;
                            while ($row_rad = fetch_array($sql_rad)) {
                                echo '<div class="col-lg-3 col-md-6 col-sm-12 col-xs-12">';
                                echo '<a href="'.$_SERVER['PHP_SELF'].'?action=radiologi&no_rawat='.$no_rawat_kunj.'" class="title"><img class="img-responsive thumbnail"  src="'.SIMRSURL.'/radiologi/'.$row_rad[3].'"></a>';
                                echo '</div>';
                                $no++;
                            }
                            ?>
                          </div>
                        </td>
                      </tr>
                      <?php } ?>
                    </tbody>
                  </table>
                </div>
                <!-- riwayat -->
                <!-- anamnese -->
                  <div class="tab-pane fade" role="tabpanel" id="anamnese">
                    <?php include_once ('./module/anamnese.php');?>
                  </div>
                <!-- anamnese -->
                <!-- diagnosa -->
                  <div role="tabpanel" class="tab-pane fade" id="diagnosa">
                    <?php include_once ('./module/diagnosa.php');?>
                  </div>

                <!-- end diagnosa -->
                <!-- eresep -->
                  <div role="tabpanel" class="tab-pane fade" id="resep">
                    <?php include_once ('./module/eresep.php');?>
                  </div>
                <!-- end eresep -->
                <!-- permintaan lab -->
                  <div role="tabpanel" class="tab-pane fade" id="permintaanlab">
                    <?php include_once ('./module/mintalab.php');?>
                  </div>
                <!-- end permintaan lab -->
                <!-- permintaan rad -->
                  <div role="tabpanel" class="tab-pane fade" id="permintaanrad">
                    <?php include_once ('./module/mintarad.php');?>
                  </div>
                <!-- end permintaan rad -->
                <!-- skdp -->
                  <div role="tabpanel" class="tab-pane fade" id="skdp">
                    <?php include_once ('./module/skdp.php');?>
                  </div>
                <!-- end skdp -->
              </div>
              <!-- Tab Panes -->
            </div>
          </div>
        </div>
      </div>
    <!-- Menu View -->
    <?php } ?>
    <!-- Menu Radiologi -->
    <?php if($action == "radiologi"){ ?>
      <div class="card">
        <div class="header">
          <h2>
            BERKAS DIGITAL RADIOLOGI
          </h2>
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
          </dl>
          <div id="aniimated-thumbnials" class="list-unstyled row clearfix">
            <?php
            $sql_rad = query("select * from gambar_radiologi where no_rawat= '{$_GET['no_rawat']}'");
            $no=1;
            while ($row_rad = fetch_array($sql_rad)) {
              echo '<div class="col-lg-3 col-md-6 col-sm-12 col-xs-12">';
              echo '<a href="'.SIMRSURL.'/radiologi/'.$row_rad[3].'" data-sub-html=""><img class="img-responsive thumbnail"  src="'.SIMRSURL.'/radiologi/'.$row_rad[3].'"></a>';
              echo '</div>';
              $no++;
            }
            ?>
          </div>
        </div>
      </div>
      <a class="btn btn-primary" href="<?php echo $_SERVER['PHP_SELF'].'?action=view&no_rawat='.$_GET['no_rawat']; ?>">BACK</a>
      <br><br>
    <?php } ?>
    <!-- end Menu Radiologi -->
    <!-- delete -->
    <?php
    if($action == "delete_diagnosa"){
    	$hapus = "DELETE FROM diagnosa_pasien WHERE no_rawat='{$_REQUEST['no_rawat']}' AND kd_penyakit = '{$_REQUEST['kode']}' AND prioritas = '{$_REQUEST['prioritas']}'";
    	$hasil = query($hapus);
    	if (($hasil)) {
    	    redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
    	}
    }

    if($action == "delete_obat"){
    	$hapus = "DELETE FROM resep_dokter WHERE no_resep='{$_REQUEST['no_resep']}' AND kode_brng='{$_REQUEST['kode_obat']}'";
    	$hasil = query($hapus);
    	if (($hasil)) {
    	    redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
    	}
    }

    if($action == "delete_lab"){
    	$hapus = "DELETE FROM permintaan_pemeriksaan_lab WHERE noorder='{$_REQUEST['noorder']}' AND kd_jenis_prw='{$_REQUEST['kd_jenis_prw']}'";
    	$hasil = query($hapus);
    	if (($hasil)) {
    	    redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
    	}
    }

    if($action == "delete_rad"){
    	$hapus = "DELETE FROM permintaan_pemeriksaan_radiologi WHERE noorder='{$_REQUEST['noorder']}' AND kd_jenis_prw='{$_REQUEST['kd_jenis_prw']}'";
    	$hasil = query($hapus);
    	if (($hasil)) {
    	    redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
    	}
    }

    if($action == "delete_an"){
      $hapus = "DELETE FROM pemeriksaan_ralan WHERE no_rawat='{$_REQUEST['no_rawat']}' AND keluhan='{$_REQUEST['keluhan']}'";
      $hasil = query($hapus);
      if (($hasil)) {
        redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
      }
    }
    ?>
    <!-- end delete -->
  </div>
</section>
<?php include_once ('layout/footer.php'); ?>
<script>
function Antri()
{
  $.ajax({
    url: './includes/ambil.php',
    type: 'POST',
    success: function(lol)
    {
      $('.antri').html(lol);
    }
  });
};

setInterval(function(){ Antri(); }, 1000);
</script>
