<?php

include_once ('layout/header.php');

if(isset($_GET['no_rawat'])) {
    $_sql = "SELECT a.no_rkm_medis, a.no_rawat, b.nm_pasien, b.umur, a.status_lanjut , a.kd_pj, c.png_jawab, b.tgl_lahir, d.nm_dokter, e.nm_poli FROM reg_periksa a, pasien b, penjab c, dokter d, poliklinik e WHERE a.no_rkm_medis = b.no_rkm_medis AND a.no_rawat = '$_GET[no_rawat]' AND a.kd_pj = c.kd_pj AND a.kd_dokter = d.kd_dokter AND a.kd_poli = e.kd_poli";
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
           $png_jawab = $row['6'];
           $tgl_lahir = $row['7'];
           $nama_dokter = $row['8'];
           $nama_poli = $row['9'];

	     }
    } else {
	redirect ("{$_SERVER['PHP_SELF']}");
    }
}
?>
<section class="content">
  <div class="container-fluid">
    <?php $action = isset($_GET['action'])?$_GET['action']:null; ?>
    <?php $do = isset($_GET['do'])?$_GET['do']:null; ?>
    <?php if(!$action){  ?>
      <!-- Menu Utama -->
      <div class="row">
        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
          <div class="card">
            <div class="header">
              <h2>
                PASIEN <?php echo $nmpoli; ?>
                <small>Tanggal : <?php if(isset($_POST['tanggal']) && $_POST['tanggal'] !="") { echo $_POST['tanggal']; } else { echo $date; } ?></small>
              </h2>
            </div>
            <div class="table-responsive">
              <ul class="nav nav-tabs tab-nav-right" role="tablist">
                <li role="presentation" class="active"><a href="#poli" data-toggle="tab">Pasien Poli</a></li>
                <li role="presentation"><a href="#intern" data-toggle="tab">Rujukan Internal</a></li>
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
                          <th>No Telpon</th>
                          <th>Dokter Tujuan</th>
                          <th>No. Antrian</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <?php
                          $_sql = "SELECT b.nm_pasien, c.nm_dokter , a.no_reg, a.no_rkm_medis, a.no_rawat, a.stts, b.no_tlp FROM reg_periksa a, pasien b, dokter c WHERE a.kd_poli = '{$_SESSION['jenis_poli']}' AND a.no_rkm_medis = b.no_rkm_medis AND a.kd_dokter = c.kd_dokter";
                            if(isset($_POST['tanggal']) && $_POST['tanggal'] !="") {
                                $_sql .= " AND a.tgl_registrasi = '{$_POST['tanggal']}'";
                            } else {
                                $_sql .= " AND a.tgl_registrasi = '$date'";
                            }
                            $_sql .= "  ORDER BY a.no_reg ASC";

                            $sql = query($_sql);
                            $no = 1;
                            while($row = fetch_array($sql)){
                              echo '<tr>';
                              echo '<td>';
                              echo '<a href="'.$_SERVER['PHP_SELF'].'?action=view&no_rawat='.$row['4'].'" class="title">'.ucwords(strtolower(SUBSTR($row['0'], 0, 20))).' ...</a>';
                              echo '</td>';
                              echo '<td>'.$row['3'].'</td>';
                              echo '<td>';
                              echo '<a href="tel:'.$row['6'].'" class="title" target="_system">'.$row['6'].'</a>';
                              echo '</td>';
                              echo '<td>'.$row['1'].'</td>';
                              echo '<td>'.$row['2'].'</td>';
                              echo '<td>'.$row['5'].'</td>';
                              echo '</tr>';
                            $no++;
                          }
                        ?>
                      </tbody>
                    </table>
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
                  <div role="tabpanel" class="tab-pane fade in" id="intern">
                    <?php include_once ('intern.php');?>
                  </div>
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
                <dt>Tgl. Lahir</dt>
                <dd><?php echo $tgl_lahir; ?></dd>
                <dt>Umur</dt>
                <dd><?php echo $umur; ?></dd>
                <dt>Cara Bayar</dt>
                <dd><?php echo $png_jawab; ?></dd>
              </dl>
            </div>
            <div class="body">
              <!-- Nav Tabs -->
              <div class="row">
                <ul class="nav nav-tabs tab-nav-right" role="tablist">
                  <li role="presentation" class="active"><a href="#riwayat" data-toggle="tab">RIWAYAT</a></li>
                  <li role="presentation"><a href="#anamnese" data-toggle="tab">PEMERIKSAAN</a></li>
                  <li role="presentation"><a href="#diagnosa" data-toggle="tab">DIAGNOSA</a></li>
                  <li role="presentation"><a href="#tindakan" data-toggle="tab">TINDAKAN</a></li>
                  <li role="presentation"><a href="#resep" data-toggle="tab">RESEP</a></li>
                  <li role="presentation"><a href="#permintaanlab" data-toggle="tab">PERMINTAAN LAB</a></li>
                  <li role="presentation"><a href="#permintaanrad" data-toggle="tab">PERMINTAAN RAD</a></li>
                  <li role="presentation"><a href="#catatan_dokter" data-toggle="tab">CATATAN</a></li>
                  <li role="presentation"><a href="#rujuk_internal" data-toggle="tab">RUJUK INTERNAL</a></li>
                  <li role="presentation"><a href="#skdp" data-toggle="tab">SURAT KONTROL</a></li>
                </ul>
              </div>
              <!-- End Nav Tabs -->
              <button class="btn bg-cyan waves-effect m-t-15 m-b-15" type="button" data-toggle="collapse" data-target="#collapseExample" aria-expanded="false" aria-controls="collapseExample">Berkas RM Lama</button>
              <div class="collapse" id="collapseExample">
                <div class="well">
                            <div id="aniimated-thumbnials" class="list-unstyled row clearfix">
                            <?php
                            $sql_rmlama = query("SELECT * FROM berkas_digital_perawatan WHERE kode = '003' AND no_rawat IN (SELECT no_rawat FROM reg_periksa WHERE no_rkm_medis = '$no_rkm_medis')");
                            $no=1;
                            while ($row_rmlama = fetch_array($sql_rmlama)) {
                                echo '<div class="col-lg-3 col-md-6 col-sm-12 col-xs-12">';
                                echo '<a href="'.SIMRSURL.'/berkasrawat/'.$row_rmlama[2].'" data-sub-html=""><img class="img-responsive thumbnail"  src="'.SIMRSURL.'/berkasrawat/'.$row_rmlama[2].'"></a>';
                                echo '</div>';
                                $no++;
                            }
                            ?>
                            <?php
                            $sql_rmlama = query("SELECT * FROM berkas_digital_perawatan WHERE kode = '006' AND no_rawat IN (SELECT no_rawat FROM reg_periksa WHERE no_rkm_medis = '$no_rkm_medis')");
                            $no=1;
                            while ($row_rmlama = fetch_array($sql_rmlama)) {
                                echo '<div class="col-lg-3 col-md-6 col-sm-12 col-xs-12">';
                                echo '<a href="'.SIMRSURL.'/berkasrawat/'.$row_rmlama[2].'" data-sub-html=""><img class="img-responsive thumbnail"  src="'.SIMRSURL.'/berkasrawat/'.$row_rmlama[2].'"></a>';
                                echo '</div>';
                                $no++;
                            }
                            ?>
                            </div>
                </div>
              </div>
              <div class="clearfix"></div>
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
                        <th>Tindakan</th>
                        <th>Obat</th>
                        <th>Laboratorium</th>
                        <th>Radiologi</th>
                        <th>Catatan Rawat</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php
                      $q_kunj = query ("SELECT tgl_registrasi, no_rawat, status_lanjut FROM reg_periksa WHERE no_rkm_medis = '$no_rkm_medis' AND stts !='Batal'");
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
                            $sql_riksaralan = fetch_assoc(query("SELECT keluhan, pemeriksaan, tinggi, berat, suhu_tubuh, tensi, nadi, respirasi FROM pemeriksaan_ralan WHERE no_rawat = '$no_rawat_kunj'"));
                            echo "<td>".$sql_riksaralan['keluhan']."</td>";
                            echo "<td>";
                            echo "<ul style='list-style:none;margin:0;padding:0;'>";
                            echo "<li>".$sql_riksaralan['pemeriksaan']."</li>";
                            if(!empty($sql_riksaralan['tinggi'])) {
                            echo "<li>Tinggi : ".$sql_riksaralan['tinggi']." cm</li>";
                            }
                            if(!empty($sql_riksaralan['berat'])) {
                              echo "<li>BB : ".$sql_riksaralan['berat']." Kg</li>";
                            }
                            if(!empty($sql_riksaralan['suhu_tubuh'])) {
                            echo "<li>Suhu : ".$sql_riksaralan['suhu_tubuh']." C</li>";
                            }
                            if(!empty($sql_riksaralan['tensi'])) {
                            echo "<li>Tensi : ".$sql_riksaralan['tensi']." mmHg</li>";
                            }
                            if(!empty($sql_riksaralan['nadi'])) {
                            echo "<li>Nadi : ".$sql_riksaralan['nadi']." x/mnt</li>";
                            }
                            if(!empty($sql_riksaralan['respirasi'])) {
                            echo "<li>RR : ".$sql_riksaralan['respirasi']." x/mnt</li>";
                            }
                            echo "</ul>";
                            echo "</td>";
                          } else {
                            $sql_riksaranap = fetch_assoc(query("SELECT keluhan, pemeriksaan , berat , suhu_tubuh FROM pemeriksaan_ranap WHERE no_rawat = '$no_rawat_kunj'"));
                            echo "<td>".$sql_riksaranap['keluhan']."</td>";
                            echo "<td><ul style='list-style:none;margin:0;padding:0;'><li>Pemeriksaan=".$sql_riksaranap['pemeriksaan']."</li></br><li>BB=".$sql_riksaranap['berat']."</li></br><li>Suhu=".$sql_riksaranap['suhu_tubuh']."</li></ul></td>";
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

      <ul style="list-style:none;margin-left:0;padding-left:0;">
        <?php
        $query = query("SELECT a.kode, b.deskripsi_pendek, a.prioritas FROM prosedur_pasien a, icd9 b, reg_periksa c WHERE a.kode = b.kode AND a.no_rawat = '{$no_rawat_kunj}' AND a.no_rawat = c.no_rawat ORDER BY a.prioritas ASC");
          $no=1;
        if(num_rows($query) !== 0){
        	echo '<li><b>Prosedur ICD 9</b></li>';
        }
         while ($data = fetch_array($query)) {
        ?>
                  <li><?php echo $no; ?>. <?php echo $data['0']; ?> - <?php echo $data['1']; ?></li>
        <?php
              $no++;
        }
        ?>
      </ul>
      <ul style="list-style:none;margin-left:0;padding-left:0;">

        <?php
        $query = query("SELECT a.kd_jenis_prw, b.nm_perawatan FROM rawat_jl_dr a, jns_perawatan b, reg_periksa c WHERE a.kd_jenis_prw = b.kd_jenis_prw AND a.no_rawat = '{$no_rawat_kunj}' AND a.no_rawat = c.no_rawat");
          $no=1;
        if(num_rows($query) !== 0){
        	echo '<li><b>Jenis Perawatan</b></li>';
        }
        while ($data = fetch_array($query)) {
        ?>
                  <li><?php echo $no; ?>. <?php echo $data['0']; ?> - <?php echo $data['1']; ?></li>
        <?php
              $no++;
        }
        ?>
      </ul>

                        </td>
                        <td>
                            <ul style="list-style:none;">
                            <?php
                            //$sql_obat = query("select detail_pemberian_obat.jml, databarang.nama_brng, resep_dokter.aturan_pakai from detail_pemberian_obat inner join databarang on detail_pemberian_obat.kode_brng=databarang.kode_brng inner join resep_obat on detail_pemberian_obat.no_rawat=resep_obat.no_rawat inner join resep_dokter on resep_dokter.no_resep=resep_obat.no_resep where detail_pemberian_obat.no_rawat= '$no_rawat_kunj'");
                            $sql_obat = query("select detail_pemberian_obat.jml, databarang.nama_brng, detail_pemberian_obat.no_rawat, databarang.kode_brng from detail_pemberian_obat inner join databarang on detail_pemberian_obat.kode_brng=databarang.kode_brng where detail_pemberian_obat.no_rawat= '$no_rawat_kunj'");
                            //$sql_obat = query("SELECT databarang.nama_brng, resep_dokter.jml, resep_dokter.aturan_pakai FROM resep_dokter, resep_obat, databarang WHERE resep_dokter.no_resep = resep_obat.no_resep AND resep_dokter.kode_brng = databarang.kode_brng AND resep_obat.no_rawat = '$no_rawat_kunj'");
                            $no=1;
                            while ($row_obat = fetch_array($sql_obat)) {
                                $get_aturan = fetch_assoc(query("SELECT resep_dokter.aturan_pakai AS aturan FROM resep_dokter, resep_obat WHERE resep_dokter.no_resep = resep_obat.no_resep AND resep_obat.no_rawat = '$row_obat[2]' AND resep_dokter.kode_brng = '{$row_obat['3']}'"));
                                echo '<li>'.$no.'. '.$row_obat[1].' - '.$get_aturan[aturan].' ('.$row_obat[0].')</li>';
                                //echo '<li>'.$no.'. '.$row_obat[1].' ('.$row_obat[0].')</li>';
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
                            <div id="aniimated-thumbnials" class="list-unstyled row clearfix">
                            <?php
                            $sql_lab = query("select * from berkas_digital_perawatan where kode = '005' and no_rawat = '$no_rawat_kunj'");
                            $no=1;
                            while ($row_lab = fetch_array($sql_lab)) {
                                echo '<div class="col-lg-3 col-md-6 col-sm-12 col-xs-12">';
                                echo '<a href="'.$_SERVER['PHP_SELF'].'?action=laboratorium&no_rawat='.$no_rawat_kunj.'" class="title"><img class="img-responsive thumbnail"  src="'.SIMRSURL.'/berkasrawat/'.$row_lab[2].'"></a>';
                                echo '</div>';
                                $no++;
                            }
                            ?>
                          </div>
                        </td>
                        <td>
                            <ul style="list-style:none;">
                            <?php
                            $sql_rad = query("select * from hasil_radiologi  where no_rawat= '$no_rawat_kunj'");
                            $no=1;
                            while ($row_rad = fetch_array($sql_rad)) {
                                echo '<li>'.$no.'. '.nl2br($row_rad[hasil]).'</li>';
                                $no++;
                            }
                            ?>
                            </ul>
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
                        <td>
	                    <?php
    	                $query = query("SELECT catatan FROM catatan_perawatan WHERE no_rawat = '{$no_rawat_kunj}'");
        	            while ($data = fetch_array($query)) {
            	        ?>
                              <?php echo nl2br($data['catatan']); ?>
                	    <?php
                    	}
                    	?>
                        </td>
                      </tr>
                      <?php } ?>
                    </tbody>
                  </table>
                </div>
                <!-- riwayat -->
                <!-- anamnese -->
                  <div class="tab-pane fade" role="tabpanel" id="anamnese">
                    <?php include_once ('./module/ralan/anamnese.php');?>
                  </div>
                <!-- anamnese -->
                <!-- diagnosa -->
                  <div role="tabpanel" class="tab-pane fade" id="diagnosa">
                    <?php include_once ('./module/ralan/diagnosa.php');?>
                  </div>
                <!-- end diagnosa -->
                <!-- tindakan -->
                  <div role="tabpanel" class="tab-pane fade" id="tindakan">
                    <?php include_once ('./module/ralan/tindakan.php'); ?>
                  </div>
                <!-- end tindakan -->
                <!-- eresep -->
                  <div role="tabpanel" class="tab-pane fade" id="resep">
                    <?php include_once ('./module/ralan/eresep.php');?>
                  </div>
                <!-- end eresep -->
                <!-- permintaan lab -->
                  <div role="tabpanel" class="tab-pane fade" id="permintaanlab">
                    <?php include_once ('./module/ralan/mintalab.php');?>
                  </div>
                <!-- end permintaan lab -->
                <!-- permintaan rad -->
                  <div role="tabpanel" class="tab-pane fade" id="permintaanrad">
                    <?php include_once ('./module/ralan/mintarad.php');?>
                  </div>
                <!-- end permintaan rad -->
                <!-- catatan -->
                  <div role="tabpanel" class="tab-pane fade" id="catatan_dokter">
                    <?php include_once ('./module/ralan/catatan-dokter.php'); ?>
                  </div>
                <!-- end catatan -->
                <!-- rujuk internal -->
                  <div role="tabpanel" class="tab-pane fade" id="rujuk_internal">
                    <?php include_once ('./module/ralan/rujuk-internal.php'); ?>
                  </div>
                <!-- end rujuk internal -->
                <!-- skdp -->
                  <div role="tabpanel" class="tab-pane fade" id="skdp">
                    <?php include_once ('./module/ralan/skdp.php');?>
                  </div>
                <!-- end skdp -->
              </div>
              <!-- Tab Panes -->
            </div>
          </div>
        </div>
      </div>

    <a id="back-to-top" href="#" class="btn btn-primary btn-lg back-to-top" role="button" title="Click to return on the top page" data-toggle="tooltip" data-placement="left"><span class="glyphicon glyphicon-chevron-up"></span></a>

    <!-- Menu View -->
    <?php } ?>
    <!-- Menu Lab -->
    <?php if($action == "laboratorium"){ ?>
      <div class="card">
        <div class="header">
          <h2>
            BERKAS DIGITAL LABORATORIUM
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
            $sql_lab = query("select * from berkas_digital_perawatan where kode = '005' AND no_rawat= '{$_GET['no_rawat']}'");
            $no=1;
            while ($row_lab = fetch_array($sql_lab)) {
              echo '<div class="col-lg-3 col-md-6 col-sm-12 col-xs-12">';
              echo '<a href="'.SIMRSURL.'/berkasrawat/'.$row_lab[2].'" data-sub-html=""><img class="img-responsive thumbnail"  src="'.SIMRSURL.'/berkasrawat/'.$row_lab[2].'"></a>';
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
    <!-- end Menu Lab -->
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

<?php if($action == 'rujuk_internal') { ?>

      <div class="card">
        <div class="header">
          <h2>
            RUJUKAN INTERNAL
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
            <dt>Poli Perujuk</dt>
            <dd><?php echo $nama_poli; ?></dd>
            <dt>Dokter Perujuk</dt>
            <dd><?php echo $nama_dokter; ?></dd>
          </dl>


  <?php
  if (isset($_POST['ok_rujuk_jawab'])) {
    if (($_POST['saran'] <> "") and ($no_rawat <> "")) {

           $insert = query("UPDATE rujukan_internal_poli_detail SET pemeriksaan = '{$_POST['pemeriksaan']}', diagnosa = '{$_POST['diagnosa']}', saran = '{$_POST['saran']}' WHERE no_rawat = '{$no_rawat}'");
           if ($insert) {
                redirect("{$_SERVER['PHP_SELF']}?action=rujuk_internal&no_rawat={$no_rawat}");
           }
    }
  }

  ?>
<dl class="dl-horizontal">
  <?php
  $data = fetch_array(query("SELECT b.nm_poli, c.nm_dokter FROM rujukan_internal_poli a, poliklinik b, dokter c WHERE a.no_rawat = '{$no_rawat}' AND a.kd_poli = b.kd_poli AND a.kd_dokter = c.kd_dokter"));
  $data1 = fetch_array(query("SELECT * FROM rujukan_internal_poli_detail WHERE no_rawat = '{$no_rawat}'"));
  ?>

  <h4>Konsul / Rujukan Internal</h4>

  <dt>Poli Tujuan</dt>
  <dd><?php echo $data['0']; ?></dd><br>
  <dt>Dokter Tujuan</dt>
  <dd><?php echo $data['1']; ?></dd><br>

  <dt>Catatan Kosul</dt>
  <dd><?php echo nl2br($data1['1']); ?></dd><br>
  <?php if(!empty($data1['saran'])) { ?>
  <h4>Jawaban Konsul</h4>
  <dt>Pemeriksaan</dt>
  <dd><?php echo $data1['2']; ?></dd><br>
  <dt>Diagnosa</dt>
  <dd><?php echo $data1['3']; ?></dd><br>
  <dt>Saran</dt>
  <dd><?php echo $data1['4']; ?></dd><br>
  <?php } ?>
</dl>


<form method="post">
<div class="row clearfix">
    <div class="col-sm-12">
        <dl class="dl-horizontal">

            <dt>Pemeriksaan</dt>
            <dd><textarea rows="4" name="pemeriksaan" class="form-control no-resize" placeholder="Tulis pemeriksaan konsul disini..."></textarea></dd><br>

            <dt>Diagnosa</dt>
            <dd><input type="text" class="form-control" name="diagnosa" placeholder="Masukkan diagnosa..."></dd><br>

            <dt>Saran Konsul</dt>
            <dd><textarea rows="8" name="saran" class="form-control no-resize" placeholder="Tulis saran konsul disini..."></textarea></dd><br>
            <dt></dt>
            <dd><button type="submit" name="ok_rujuk_jawab" value="ok_rujuk_jawab" class="btn bg-indigo waves-effect" onclick="this.value=\'ok_rujuk_jawab\'">SIMPAN</button></dd><br>
            <dt></dt>
        </dl>
    </div>
</div>
</form>

        </div>
    </div>


<?php } ?>

    <!-- delete -->
    <?php
    if($action == "delete_diagnosa"){
    	$hapus = "DELETE FROM diagnosa_pasien WHERE no_rawat='{$_REQUEST['no_rawat']}' AND kd_penyakit = '{$_REQUEST['kode']}' AND prioritas = '{$_REQUEST['prioritas']}'";
    	$hasil = query($hapus);
    	if (($hasil)) {
    	    redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
    	}
    }

    if($action == "delete_prosedur"){
    	$hapus = "DELETE FROM prosedur_pasien WHERE no_rawat='{$_REQUEST['no_rawat']}' AND kode = '{$_REQUEST['kode']}' AND prioritas = '{$_REQUEST['prioritas']}'";
    	$hasil = query($hapus);
    	if (($hasil)) {
    	    redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
    	}
    }

    if($action == "delete_perawatan"){
    	$hapus = "DELETE FROM rawat_jl_dr WHERE no_rawat='{$_REQUEST['no_rawat']}' AND kd_jenis_prw = '{$_REQUEST['kode']}' AND kd_dokter = '{$_SESSION['username']}'";
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

    if($action == "delete_catatan"){
      $hapus = "DELETE FROM catatan_perawatan WHERE no_rawat='{$_REQUEST['no_rawat']}' AND kd_dokter='{$_SESSION['username']}'";
      $hasil = query($hapus);
      if (($hasil)) {
        redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
      }
    }
    if($action == "delete_an"){
      $hapus = "DELETE FROM pemeriksaan_ralan WHERE no_rawat='{$_REQUEST['no_rawat']}'";
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
