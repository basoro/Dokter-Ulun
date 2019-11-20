<?php

include_once ('layout/header.php');

if(isset($_GET['no_rawat'])) {
    $_sql = "SELECT a.no_rkm_medis, a.no_rawat, b.nm_pasien, b.umur, a.kd_dokter, a.status_lanjut, a.kd_pj, c.png_jawab, b.tgl_lahir FROM reg_periksa a, pasien b, penjab c WHERE a.no_rkm_medis = b.no_rkm_medis AND a.no_rawat = '$_GET[no_rawat]' AND a.kd_pj = c.kd_pj";
    $found_pasien = query($_sql);
    if(num_rows($found_pasien) == 1) {
	     while($row = fetch_array($found_pasien)) {
	        $no_rkm_medis  = $row['0'];
	        $get_no_rawat	     = $row['1'];
            $no_rawat	     = $row['1'];
	        $nm_pasien     = $row['2'];
	        $umur          = $row['3'];
          $dokter          = $row['4'];
          $status_lanjut   = $row['5'];
          $kd_pj         = $row['6'];
           $png_jawab = $row['7'];
           $tgl_lahir = $row['8'];
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

            <!-- Basic Examples -->
            <div class="row">
                <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                    <div class="card">
                        <div class="header">
                            <h2>
                                PASIEN RAWAT INAP
                            </h2>
                        </div>
                        <div class="table-responsive">
                          <div class="body">
                            <table id="datatable_ranap" class="table responsive table-bordered table-striped table-hover display nowrap js-exportable" width="100%">
                                <thead>
                                    <tr>
                                        <th>Nama</th>
                                        <th>Nomer MR</th>
                                        <th>Kamar</th>
                                        <th>Bed</th>
                                        <th>Tanggal Masuk</th>
                                        <th>Cara Bayar</th>
                                     </tr>
                                </thead>
                                <tbody>
                                <!-- This query based on Adly's (Adly Hidayat S.KOM) query. Thanks bro -->
                                <?php
                                $sql = "
                                	SELECT
                                		pasien.nm_pasien,
                                    	reg_periksa.no_rkm_medis,
                                    	bangsal.nm_bangsal,
                                    	kamar_inap.kd_kamar,
                                    	kamar_inap.tgl_masuk,
                                    	penjab.png_jawab,
                                    	reg_periksa.no_rawat
                                    FROM
                                    	kamar_inap,
                                        reg_periksa,
                                        pasien,
                                        bangsal,
                                        kamar,
                                        penjab,
                                        dpjp_ranap
                                    WHERE
                                    	kamar_inap.no_rawat = reg_periksa.no_rawat
                                    AND
                                    	reg_periksa.no_rkm_medis = pasien.no_rkm_medis
                                    AND
                                    	kamar_inap.kd_kamar = kamar.kd_kamar
                                    AND
                                    	kamar.kd_bangsal = bangsal.kd_bangsal
                                    AND
                                    	kamar_inap.stts_pulang = '-'
                                    AND
                                    	reg_periksa.kd_pj = penjab.kd_pj
                                    AND
                                    	dpjp_ranap.no_rawat = reg_periksa.no_rawat
                                    AND
                                    	dpjp_ranap.kd_dokter = '{$_SESSION['username']}'
                                ";
                                $sql .= " ORDER BY kamar_inap.tgl_masuk ASC";
                                $result = query($sql);
        						$no = 1;
                                while($row = fetch_array($result)) {
                                  $get_no_rawat = $row['6'];
                                ?>
                                    <tr>
                                        <td><a href="<?php echo $_SERVER['PHP_SELF']; ?>?action=view&no_rawat=<?php echo $row['6'];?>"><?php echo SUBSTR($row['0'], 0, 25).' ...'; ?></a></td>
                                        <td><?php echo $row['1']; ?></td>
                                        <td><?php echo $row['2']; ?></td>
                                        <td><?php echo $row['3']; ?></td>
                                        <td><?php echo $row['4']; ?></td>
                                        <td><?php echo $row['5']; ?></td>
                                    </tr>
                                <?php
                                  $no++;
                                }
                                ?>
                                </tbody>
                            </table>
                          </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- #END# Basic Examples -->

    <?php } ?>

    <?php if($action == "view"){ ?>

            <!-- Basic Examples -->
            <div class="row clearfix">
                <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                    <div class="card">
                        <div class="header">
                            <h2>
                                Detail Pasien
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
                                <dt>Tgl. Lahir</dt>
                                <dd><?php echo $tgl_lahir; ?></dd>
                                <dt>Cara Bayar</dt>
                                <dd><?php echo $png_jawab; ?></dd>
                            </dl>
                        </div>

                        <div class="body">
                        <!-- Nav tabs -->
                          	<div class="row">
                              <ul class="nav nav-tabs tab-nav-right" role="tablist">
                                <li role="presentation" class="active"><a href="#riwayat" data-toggle="tab">RIWAYAT</a></li>
                                <li role="presentation"><a href="#anamnese" data-toggle="tab">PEMERIKSAAN</a></li>
                                <li role="presentation"><a href="#diagnosa" data-toggle="tab">DIAGNOSA</a></li>
                                <li role="presentation"><a href="#resep" data-toggle="tab">RESEP</a></li>
                                <li role="presentation"><a href="#reseppulang" data-toggle="tab">RESEP PULANG</a></li>
                                <li role="presentation"><a href="#permintaanlab" data-toggle="tab">PERMINTAAN LAB</a></li>
                                <li role="presentation"><a href="#permintaanrad" data-toggle="tab">PERMINTAAN RAD</a></li>
                                <li role="presentation"><a href="#skdp" data-toggle="tab">SURAT KONTROL</a></li>
                              </ul>
                          	</div>

                            <form method="post" action="">
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
                                            <?php
                                            $sql_rad = query("select * from hasil_radiologi  where no_rawat= '$no_rawat_kunj'");
                                            while ($row_rad = fetch_array($sql_rad)) {
                                                echo nl2br($row_rad[hasil]);
                                            }
                                            ?>
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
                                    <?php include_once ('./module/ranap/anamnese.php');?>
                                  </div>
                                <!-- anamnese -->
                                <!-- diagnosa -->
                                  <div role="tabpanel" class="tab-pane fade" id="diagnosa">
                                    <?php include_once ('./module/ranap/diagnosa.php');?>
                                  </div>

                                <!-- end diagnosa -->
                                <!-- eresep -->
                                  <div role="tabpanel" class="tab-pane fade" id="resep">
                                    <?php include_once ('./module/ranap/eresep.php');?>
                                  </div>
                                <!-- end eresep -->
                                <!-- eresep pulang -->
                                  <div role="tabpanel" class="tab-pane fade" id="reseppulang">
                                    <?php include_once ('./module/ranap/eresep_pulang.php');?>
                                  </div>
                                <!-- end eresep pulang -->
                                <!-- permintaan lab -->
                                  <div role="tabpanel" class="tab-pane fade" id="permintaanlab">
                                    <?php include_once ('./module/ranap/mintalab.php');?>
                                  </div>
                                <!-- end permintaan lab -->
                                <!-- permintaan rad -->
                                  <div role="tabpanel" class="tab-pane fade" id="permintaanrad">
                                    <?php include_once ('./module/ranap/mintarad.php');?>
                                  </div>
                                <!-- end permintaan rad -->
                                <!-- skdp -->
                                  <div role="tabpanel" class="tab-pane fade" id="skdp">
                                    <?php include_once ('./module/ranap/skdp.php');?>
                                  </div>
                                <!-- end skdp -->
                              </div>
                              <!-- Tab Panes -->
                        </form>
                    </div>
                </div>
            </div>
          </div>
    <?php } ?>

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
                                <dt>Tgl. Lahir</dt>
                                <dd><?php echo $tgl_lahir; ?></dd>
                                <dt>Cara Bayar</dt>
                                <dd><?php echo $png_jawab; ?></dd>

                            </dl>
						    <hr>
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

    <?php

    //delete
    if($action == "delete_diagnosa"){

	$hapus = "DELETE FROM diagnosa_pasien WHERE no_rawat='{$_REQUEST['no_rawat']}' AND kd_penyakit = '{$_REQUEST['kode']}' AND prioritas = '{$_REQUEST['prioritas']}'";
	$hasil = query($hapus);
	if (($hasil)) {
	    redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
	}

    }

    //delete
    if($action == "delete_obat"){

	$hapus = "DELETE FROM resep_dokter WHERE no_resep='{$_REQUEST['no_resep']}' AND kode_brng='{$_REQUEST['kode_obat']}'";
	$hasil = query($hapus);
	if (($hasil)) {
	    redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
	}

    }

    //delete
    if($action == "delete_obat_pulang"){

	$hapus = "DELETE FROM resep_pulang WHERE no_rawat='{$_REQUEST['no_rawat']}' AND kode_brng='{$_REQUEST['kode_obat']}'";
	$hasil = query($hapus);
	if (($hasil)) {
	    redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
	}

    }

    //delete
    if($action == "delete_lab"){

	$hapus = "DELETE FROM permintaan_pemeriksaan_lab WHERE noorder='{$_REQUEST['noorder']}' AND kd_jenis_prw='{$_REQUEST['kd_jenis_prw']}'";
	$hasil = query($hapus);
	if (($hasil)) {
	    redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
	}

    }

    //delete
    if($action == "delete_rad"){

	$hapus = "DELETE FROM permintaan_pemeriksaan_radiologi WHERE noorder='{$_REQUEST['noorder']}' AND kd_jenis_prw='{$_REQUEST['kd_jenis_prw']}'";
	$hasil = query($hapus);
	if (($hasil)) {
	    redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
	}

    }
    if($action == "delete_an"){
      $hapus = "DELETE FROM pemeriksaan_ranap WHERE no_rawat='{$_REQUEST['no_rawat']}' AND keluhan='{$_REQUEST['keluhan']}'";
      $hasil = query($hapus);
      if (($hasil)) {
        redirect("{$_SERVER['PHP_SELF']}?action=view&no_rawat={$no_rawat}");
      }
    }

    ?>

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
